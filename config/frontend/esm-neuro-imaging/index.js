/**
 * CHU Frantz Fanon Blida - Service de Neurochirurgie
 * Micro-frontend: @openmrs/esm-neuro-imaging-app
 * Intégration PACS Orthanc, Visualiseur OHIF Viewer, Station OHIF-AI (MedSAM2),
 * Assistant Clinique MedGemma et Dictée Vocale Médicale Qwen3-ASR pour OpenMRS 3.x
 */
(function () {
  'use strict';

  // --- Helpers pour contexte patient ---
  function getPatientUuid(props) {
    if (props && props.patientUuid) return props.patientUuid;
    if (props && props.patient && props.patient.id) return props.patient.id;
    var match = window.location.pathname.match(/\/patient\/([^\/]+)\/chart/);
    return match ? match[1] : null;
  }

  async function fetchPatientDetails(patientUuid) {
    if (!patientUuid) return null;
    try {
      var res = await fetch('/openmrs/ws/rest/v1/patient/' + patientUuid + '?v=custom:(uuid,display,person:(display,gender,age,birthdate),identifiers:(identifier,identifierType:(name)))');
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('Error fetching patient details:', e);
      return null;
    }
  }

  function getHospitalIdentifier(patient) {
    if (!patient || !patient.identifiers) return null;
    var idObj = patient.identifiers.find(function (i) {
      return i.identifierType && (i.identifierType.name === 'N° de dossier' || i.identifierType.name === 'OpenMRS ID');
    });
    return idObj ? idObj.identifier : (patient.identifiers[0] ? patient.identifiers[0].identifier : null);
  }

  function getNinIdentifier(patient) {
    if (!patient || !patient.identifiers) return null;
    var idObj = patient.identifiers.find(function (i) {
      return i.identifierType && i.identifierType.name === 'NIN';
    });
    return idObj ? idObj.identifier : null;
  }

  // --- DICOMweb Queries ---
  async function fetchDicomStudies(patientId) {
    if (!patientId) return [];
    try {
      var url = '/dicom-web/studies?PatientID=' + encodeURIComponent(patientId);
      var res = await fetch(url);
      if (!res.ok) {
        var allRes = await fetch('/dicom-web/studies');
        if (!allRes.ok) return [];
        var allData = await allRes.json();
        return allData.filter(function (s) {
          return s['00100020'] && s['00100020'].Value && s['00100020'].Value[0] === patientId;
        });
      }
      return await res.json();
    } catch (e) {
      console.error('Error fetching DICOM studies:', e);
      return [];
    }
  }

  async function fetchStudySeries(studyUid) {
    try {
      var res = await fetch('/dicom-web/studies/' + studyUid + '/series');
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('Error fetching study series:', e);
      return [];
    }
  }

  function parseStudy(raw) {
    var uid = raw['0020000D'] && raw['0020000D'].Value ? raw['0020000D'].Value[0] : '';
    var dateRaw = raw['00080020'] && raw['00080020'].Value ? raw['00080020'].Value[0] : '';
    var desc = raw['00081030'] && raw['00081030'].Value ? raw['00081030'].Value[0] : 'Examen d\'imagerie';
    var modalities = raw['00080061'] && raw['00080061'].Value ? raw['00080061'].Value : [];
    var seriesCount = raw['00201206'] && raw['00201206'].Value ? raw['00201206'].Value[0] : '-';
    var instanceCount = raw['00201208'] && raw['00201208'].Value ? raw['00201208'].Value[0] : '-';

    var formattedDate = dateRaw;
    if (dateRaw && dateRaw.length === 8) {
      formattedDate = dateRaw.substring(6, 8) + '/' + dateRaw.substring(4, 6) + '/' + dateRaw.substring(0, 4);
    }

    return {
      uid: uid,
      description: desc,
      modalities: modalities,
      date: formattedDate,
      dateRaw: dateRaw,
      seriesCount: seriesCount,
      instanceCount: instanceCount,
    };
  }

  function getModalityBadge(modality) {
    var bg = '#005d5d'; // Carbon teal
    var label = modality;
    if (modality === 'MR') {
      bg = '#0072c3'; // Blue
      label = 'IRM (MR)';
    } else if (modality === 'CT') {
      bg = '#8a3ffc'; // Purple
      label = 'Scanner (CT)';
    } else if (modality === 'CR' || modality === 'DX') {
      bg = '#0e6027'; // Green
      label = 'Radio (XR)';
    }
    return '<span style="display:inline-block; padding:2px 8px; border-radius:12px; background:' + bg + '; color:#fff; font-size:12px; font-weight:600; margin-right:6px;">' + label + '</span>';
  }

  // --- Audio Recording & WAV 16kHz Encoder (HTML5 Web Audio) ---
  function encodeWav(samples, sampleRate) {
    var buffer = new ArrayBuffer(44 + samples.length * 2);
    var view = new DataView(buffer);
    function writeString(v, offset, str) {
      for (var i = 0; i < str.length; i++) {
        v.setUint8(offset + i, str.charCodeAt(i));
      }
    }
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * 1 channel * 2 bytes)
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    var offset = 44;
    for (var i = 0; i < samples.length; i++, offset += 2) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  function downsampleBuffer(buffer, inputRate, outputRate) {
    if (outputRate === inputRate) return buffer;
    var ratio = inputRate / outputRate;
    var newLength = Math.round(buffer.length / ratio);
    var result = new Float32Array(newLength);
    var offsetResult = 0;
    var offsetBuffer = 0;
    while (offsetResult < result.length) {
      var nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      var accum = 0, count = 0;
      for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  // Classe utilitaire pour capture microphone
  function AudioRecorder() {
    this.mediaStream = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.processorNode = null;
    this.recordedSamples = [];
    this.isRecording = false;
  }

  AudioRecorder.prototype.start = async function () {
    var self = this;
    self.recordedSamples = [];
    self.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    self.audioContext = new AudioCtx();
    self.sourceNode = self.audioContext.createMediaStreamSource(self.mediaStream);
    self.processorNode = self.audioContext.createScriptProcessor(4096, 1, 1);

    self.processorNode.onaudioprocess = function (e) {
      if (!self.isRecording) return;
      var inputData = e.inputBuffer.getChannelData(0);
      var copy = new Float32Array(inputData.length);
      copy.set(inputData);
      self.recordedSamples.push(copy);
    };

    self.sourceNode.connect(self.processorNode);
    self.processorNode.connect(self.audioContext.destination);
    self.isRecording = true;
  };

  AudioRecorder.prototype.stop = async function () {
    var self = this;
    self.isRecording = false;

    if (self.processorNode && self.sourceNode) {
      self.sourceNode.disconnect();
      self.processorNode.disconnect();
    }
    if (self.mediaStream) {
      self.mediaStream.getTracks().forEach(function (t) { t.stop(); });
    }

    var totalLength = 0;
    for (var i = 0; i < self.recordedSamples.length; i++) {
      totalLength += self.recordedSamples[i].length;
    }
    var merged = new Float32Array(totalLength);
    var offset = 0;
    for (var j = 0; j < self.recordedSamples.length; j++) {
      merged.set(self.recordedSamples[j], offset);
      offset += self.recordedSamples[j].length;
    }

    var nativeRate = self.audioContext ? self.audioContext.sampleRate : 44100;
    if (self.audioContext && self.audioContext.state !== 'closed') {
      await self.audioContext.close();
    }

    var downsampled = downsampleBuffer(merged, nativeRate, 16000);
    return encodeWav(downsampled, 16000);
  };

  // --- API Callers vers Serveur 2 ---
  async function apiTranscribeAudio(wavBlob, prompt) {
    var url = '/api/clinical-assistant/v1/transcribe?lang=fr';
    if (prompt) url += '&prompt=' + encodeURIComponent(prompt);
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: wavBlob
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.detail || 'Erreur lors de la transcription (' + res.status + ')');
    }
    return await res.json();
  }

  async function apiDraftOperativeReport(payload) {
    var res = await fetch('/api/clinical-assistant/v1/draft/operative-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.detail || 'Erreur MedGemma (' + res.status + ')');
    }
    return await res.json();
  }

  async function apiDraftDischargeLetter(payload) {
    var res = await fetch('/api/clinical-assistant/v1/draft/discharge-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.detail || 'Erreur MedGemma (' + res.status + ')');
    }
    return await res.json();
  }

  async function apiChatAssistant(messages, patientContext) {
    var res = await fetch('/api/clinical-assistant/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages, patient_context: patientContext })
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.detail || 'Erreur MedGemma (' + res.status + ')');
    }
    return await res.json();
  }

  // ==========================================
  // 1. Sidebar Dashboard Links
  // ==========================================
  function createImagingDashboardLink() {
    return {
      bootstrap: async function () {},
      mount: async function (props) {
        var patientUuid = getPatientUuid(props);
        var dom = props.domElement;
        var chartBase = '/openmrs/spa/patient/' + patientUuid + '/chart';
        var targetUrl = chartBase + '/imaging';
        var isCurrent = window.location.pathname.indexOf('/imaging') !== -1;

        dom.innerHTML = [
          '<div>',
          '  <a href="' + targetUrl + '" class="cds--side-nav__link ' + (isCurrent ? 'cds--side-nav__link--current' : '') + '" id="neuro-imaging-nav-item" style="display:flex; align-items:center;">',
          '    <span class="-esm-patient-chart__dashboard-module__menu___yHCKe" style="display:flex; align-items:center; width:100%;">',
          '      <svg class="omrs-icon -esm-patient-chart__icons-module__icon___J3n4f -esm-patient-chart__dashboard-module__icon___xVkJx" height="16" width="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right:8px;">',
          '        <path d="M14 2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zm-1 10H3V4h10v8z"/>',
          '        <circle cx="8" cy="8" r="2.5"/>',
          '      </svg>',
          '      <span>Imagerie médicale</span>',
          '    </span>',
          '  </a>',
          '</div>'
        ].join('');

        var link = dom.querySelector('a');
        if (link) {
          link.addEventListener('click', function (e) {
            e.preventDefault();
            if (window.singleSpaNavigate) window.singleSpaNavigate(targetUrl);
            else {
              window.history.pushState({}, '', targetUrl);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          });
        }
      },
      unmount: async function (props) { if (props.domElement) props.domElement.innerHTML = ''; },
      update: async function () {}
    };
  }

  function createAiAssistantDashboardLink() {
    return {
      bootstrap: async function () {},
      mount: async function (props) {
        var patientUuid = getPatientUuid(props);
        var dom = props.domElement;
        var chartBase = '/openmrs/spa/patient/' + patientUuid + '/chart';
        var targetUrl = chartBase + '/assistant';
        var isCurrent = window.location.pathname.indexOf('/assistant') !== -1;

        dom.innerHTML = [
          '<div>',
          '  <a href="' + targetUrl + '" class="cds--side-nav__link ' + (isCurrent ? 'cds--side-nav__link--current' : '') + '" id="neuro-ai-assistant-nav-item" style="display:flex; align-items:center;">',
          '    <span class="-esm-patient-chart__dashboard-module__menu___yHCKe" style="display:flex; align-items:center; width:100%;">',
          '      <svg class="omrs-icon -esm-patient-chart__icons-module__icon___J3n4f -esm-patient-chart__dashboard-module__icon___xVkJx" height="16" width="16" viewBox="0 0 16 16" fill="#6929c4" style="margin-right:8px;">',
          '        <path d="M8 1a5 5 0 0 0-5 5v1a4 4 0 0 0-2 3.5v.5a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H3V6a4 4 0 1 1 8 0v1h-1a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a2 2 0 0 0 2-2v-.5A4 4 0 0 0 13 7V6a5 5 0 0 0-5-5z"/>',
          '        <path d="M6 14a2 2 0 0 0 4 0H6z"/>',
          '      </svg>',
          '      <span style="font-weight:600; color:#6929c4;">Assistant IA & Dictée</span>',
          '    </span>',
          '  </a>',
          '</div>'
        ].join('');

        var link = dom.querySelector('a');
        if (link) {
          link.addEventListener('click', function (e) {
            e.preventDefault();
            if (window.singleSpaNavigate) window.singleSpaNavigate(targetUrl);
            else {
              window.history.pushState({}, '', targetUrl);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          });
        }
      },
      unmount: async function (props) { if (props.domElement) props.domElement.innerHTML = ''; },
      update: async function () {}
    };
  }

  // ==========================================
  // 2. Imaging Dashboard Page (avec OHIF-AI)
  // ==========================================
  function createImagingDashboardPage() {
    return {
      bootstrap: async function () {},
      mount: async function (props) {
        var patientUuid = getPatientUuid(props);
        var dom = props.domElement;

        dom.innerHTML = [
          '<div style="padding: 24px; font-family: IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">',
          '  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:12px;">',
          '    <div>',
          '      <h2 style="font-size:20px; font-weight:600; color:#161616; margin:0 0 4px 0;">Imagerie Médicale, PACS & OHIF-AI</h2>',
          '      <p style="font-size:13px; color:#525252; margin:0;">CHU Frantz Fanon Blida • Service de Neurochirurgie • Orthanc PACS & MONAI Label (MedSAM2)</p>',
          '    </div>',
          '    <div style="display:flex; gap:10px; flex-wrap:wrap;">',
          '      <a href="/ohif-ai/" target="_blank" class="cds--btn cds--btn--primary cds--btn--sm" style="display:inline-flex; align-items:center; text-decoration:none; padding:8px 14px; background:#6929c4; color:#fff; border-radius:4px; font-size:13px; font-weight:600; box-shadow:0 1px 3px rgba(0,0,0,0.15);">',
          '        <span>🧠 Station OHIF-AI (MedSAM2) ↗</span>',
          '      </a>',
          '      <a href="/ohif/" target="_blank" class="cds--btn cds--btn--secondary cds--btn--sm" style="display:inline-flex; align-items:center; text-decoration:none; padding:8px 14px; background:#393939; color:#fff; border-radius:4px; font-size:13px; font-weight:600;">',
          '        <span>Station OHIF Standard ↗</span>',
          '      </a>',
          '      <button id="btn-open-upload-modal" class="cds--btn cds--btn--primary cds--btn--sm" style="display:inline-flex; align-items:center; border:none; padding:8px 14px; background:#005d5d; color:#fff; border-radius:4px; font-size:13px; font-weight:600; cursor:pointer;">',
          '        <span>+ Importer CD / USB</span>',
          '      </button>',
          '    </div>',
          '  </div>',
          '  <div id="imaging-page-content" style="min-height: 250px;">',
          '    <div style="padding:40px; text-align:center; color:#525252;">Chargement des examens PACS...</div>',
          '  </div>',
          '</div>'
        ].join('');

        // Modal container for CD/USB import
        var modalHtml = [
          '<div id="dicom-upload-modal" style="display:none; position:fixed; z-index:9999; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); align-items:center; justify-content:center;">',
          '  <div style="background:#fff; width:540px; border-radius:8px; padding:24px; box-shadow:0 8px 24px rgba(0,0,0,0.25);">',
          '    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">',
          '      <h3 style="margin:0; font-size:18px; font-weight:600; color:#161616;">Importer un examen DICOM (CD / USB)</h3>',
          '      <button id="btn-close-upload-modal" style="background:none; border:none; font-size:20px; cursor:pointer; color:#525252;">&times;</button>',
          '    </div>',
          '    <p style="font-size:13px; color:#525252; margin:0 0 16px 0;">Sélectionnez les coupes ou l\'archive DICOM provenant du CD externe du patient. Les examens seront automatiquement rattachés à ce dossier médical.</p>',
          '    <div id="dicom-dropzone" style="border:2px dashed #005d5d; background:#f4f7f7; border-radius:6px; padding:32px 16px; text-align:center; cursor:pointer; margin-bottom:16px;">',
          '      <div style="font-size:32px; margin-bottom:8px;">💿</div>',
          '      <div style="font-weight:600; color:#005d5d; font-size:14px;">Glissez-déposez les fichiers DICOM ici</div>',
          '      <div style="font-size:12px; color:#525252; margin-top:4px;">ou cliquez pour parcourir les dossiers du CD/USB</div>',
          '      <input type="file" id="dicom-file-input" multiple webkitdirectory style="display:none;" />',
          '    </div>',
          '    <div id="upload-status" style="font-size:13px; color:#525252; min-height:24px; margin-bottom:16px;"></div>',
          '    <div style="display:flex; justify-content:flex-end; gap:8px;">',
          '      <button id="btn-cancel-upload" style="border:1px solid #c6c6c6; background:#fff; color:#161616; padding:8px 16px; border-radius:4px; font-size:13px; cursor:pointer;">Fermer</button>',
          '      <button id="btn-submit-upload" style="border:none; background:#005d5d; color:#fff; padding:8px 16px; border-radius:4px; font-size:13px; cursor:pointer;" disabled>Démarrer l\'importation</button>',
          '    </div>',
          '  </div>',
          '</div>'
        ].join('');

        var modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = modalHtml;
        dom.appendChild(modalWrapper);

        var patient = await fetchPatientDetails(patientUuid);
        var hospId = getHospitalIdentifier(patient);
        var ninId = getNinIdentifier(patient);
        var patientName = patient && patient.display ? patient.display.split('-')[1] || patient.display : 'Patient inconnu';

        var contentContainer = dom.querySelector('#imaging-page-content');
        if (!hospId) {
          contentContainer.innerHTML = '<div style="padding:24px; background:#fff8e1; border-left:4px solid #f1c21b; font-size:14px; color:#161616;">Aucun identifiant hospitalier trouvé pour ce patient.</div>';
          return;
        }

        var rawStudies = await fetchDicomStudies(hospId);
        var studies = rawStudies.map(parseStudy);

        var bannerHtml = [
          '<div style="background:#f4f4f4; border-radius:6px; padding:12px 16px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">',
          '  <div style="display:flex; gap:20px; align-items:center; flex-wrap:wrap;">',
          '    <div><span style="font-size:12px; color:#525252;">Patient:</span> <strong style="font-size:14px; color:#161616;">' + patientName + '</strong></div>',
          '    <div><span style="font-size:12px; color:#525252;">N° Dossier:</span> <strong style="font-size:14px; color:#005d5d;">' + hospId + '</strong></div>',
          ninId ? '    <div><span style="font-size:12px; color:#525252;">NIN:</span> <span style="font-size:13px; color:#161616;">' + ninId + '</span></div>' : '',
          '  </div>',
          '  <div style="display:flex; align-items:center; gap:12px;">',
          '    <div style="display:flex; align-items:center; gap:6px;">',
          '      <span style="width:8px; height:8px; border-radius:50%; background:#24a148; display:inline-block;"></span>',
          '      <span style="font-size:12px; color:#161616; font-weight:600;">Orthanc PACS Actif</span>',
          '    </div>',
          '    <div style="display:flex; align-items:center; gap:6px;">',
          '      <span style="width:8px; height:8px; border-radius:50%; background:#6929c4; display:inline-block;"></span>',
          '      <span style="font-size:12px; color:#6929c4; font-weight:600;">OHIF-AI / MedSAM2 Prêt</span>',
          '    </div>',
          '  </div>',
          '</div>'
        ].join('');

        if (studies.length === 0) {
          contentContainer.innerHTML = bannerHtml + [
            '<div style="padding:48px 24px; text-align:center; background:#f4f4f4; border-radius:8px;">',
            '  <div style="font-size:40px; margin-bottom:12px;">🩻</div>',
            '  <h4 style="font-size:16px; font-weight:600; color:#161616; margin:0 0 6px 0;">Aucun examen PACS pour ce patient</h4>',
            '  <p style="font-size:13px; color:#525252; margin:0 0 16px 0;">Le dossier hospitalier <strong>' + hospId + '</strong> ne comporte actuellement aucun examen DICOM dans le serveur Orthanc.</p>',
            '  <button id="btn-empty-upload" style="border:none; padding:8px 16px; background:#005d5d; color:#fff; border-radius:4px; font-size:13px; font-weight:600; cursor:pointer;">',
            '    + Importer un CD ou clé USB',
            '  </button>',
            '</div>'
          ].join('');

          var emptyUploadBtn = contentContainer.querySelector('#btn-empty-upload');
          if (emptyUploadBtn) {
            emptyUploadBtn.addEventListener('click', function () {
              dom.querySelector('#dicom-upload-modal').style.display = 'flex';
            });
          }
        } else {
          var cardsHtml = studies.map(function (s) {
            var badges = s.modalities.map(getModalityBadge).join(' ');
            var ohifViewerUrl = '/ohif/viewer?StudyInstanceUIDs=' + encodeURIComponent(s.uid);
            var ohifAiUrl = '/ohif-ai/viewer?StudyInstanceUIDs=' + encodeURIComponent(s.uid);

            return [
              '<div class="imaging-study-card" style="background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:18px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06); transition:box-shadow 0.2s;" onmouseover="this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.12)\'" onmouseout="this.style.boxShadow=\'0 1px 3px rgba(0,0,0,0.06)\'">',
              '  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; flex-wrap:wrap; gap:12px;">',
              '    <div>',
              '      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">',
              badges,
              '        <span style="font-size:13px; color:#525252; font-weight:600;">Date: ' + s.date + '</span>',
              '      </div>',
              '      <h3 style="font-size:17px; font-weight:600; color:#161616; margin:0 0 6px 0;">' + s.description + '</h3>',
              '      <div style="font-size:13px; color:#525252;">Volume: <strong>' + s.seriesCount + ' séries</strong> • <strong>' + s.instanceCount + ' coupes DICOM</strong></div>',
              '    </div>',
              '    <div style="display:flex; gap:8px; flex-wrap:wrap;">',
              '      <a href="' + ohifAiUrl + '" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:#6929c4; color:#fff; padding:8px 16px; border-radius:4px; font-size:13px; font-weight:600; text-decoration:none; box-shadow:0 1px 3px rgba(0,0,0,0.12); cursor:pointer;">',
              '        <span>🧠 Ouvrir dans OHIF-AI (Segmentation) ↗</span>',
              '      </a>',
              '      <a href="' + ohifViewerUrl + '" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:#005d5d; color:#fff; padding:8px 14px; border-radius:4px; font-size:13px; font-weight:600; text-decoration:none; cursor:pointer;">',
              '        <span>👁️ OHIF Standard ↗</span>',
              '      </a>',
              '      <button class="btn-toggle-series" data-study-uid="' + s.uid + '" style="background:#f4f4f4; border:1px solid #c6c6c6; color:#161616; padding:8px 12px; border-radius:4px; font-size:13px; cursor:pointer;">',
              '        Détails des séries ▼',
              '      </button>',
              '    </div>',
              '  </div>',
              '  <div style="font-size:11px; color:#8d8d8d; background:#f9f9f9; padding:6px 10px; border-radius:4px; word-break:break-all;">',
              '    <strong>StudyInstanceUID:</strong> ' + s.uid,
              '  </div>',
              '  <div id="series-container-' + s.uid.replace(/\./g, '_') + '" style="display:none; margin-top:14px; padding-top:14px; border-top:1px solid #e0e0e0;">',
              '    <div style="font-size:12px; color:#525252;">Chargement des séries...</div>',
              '  </div>',
              '</div>'
            ].join('');
          }).join('');

          contentContainer.innerHTML = bannerHtml + cardsHtml;

          // Wire series toggle buttons
          contentContainer.querySelectorAll('.btn-toggle-series').forEach(function (btn) {
            btn.addEventListener('click', async function () {
              var studyUid = btn.getAttribute('data-study-uid');
              var containerId = 'series-container-' + studyUid.replace(/\./g, '_');
              var container = contentContainer.querySelector('#' + containerId);
              if (!container) return;

              if (container.style.display === 'none') {
                container.style.display = 'block';
                btn.textContent = 'Masquer les séries ▲';
                var rawSeries = await fetchStudySeries(studyUid);
                if (rawSeries.length === 0) {
                  container.innerHTML = '<div style="font-size:12px; color:#525252;">Aucune série détaillée disponible.</div>';
                } else {
                  var seriesRows = rawSeries.map(function (ser) {
                    var sNum = ser['00200011'] && ser['00200011'].Value ? ser['00200011'].Value[0] : '-';
                    var sDesc = ser['0008103E'] && ser['0008103E'].Value ? ser['0008103E'].Value[0] : 'Série standard';
                    var sMod = ser['00080060'] && ser['00080060'].Value ? ser['00080060'].Value[0] : '-';
                    var sInst = ser['00201209'] && ser['00201209'].Value ? ser['00201209'].Value[0] : '-';
                    return '<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:6px 10px;">#' + sNum + '</td><td style="padding:6px 10px; font-weight:600;">' + sDesc + '</td><td style="padding:6px 10px;"><span style="background:#e0e0e0; padding:2px 6px; border-radius:4px; font-size:11px;">' + sMod + '</span></td><td style="padding:6px 10px; text-align:right;">' + sInst + ' coupes</td></tr>';
                  }).join('');

                  container.innerHTML = [
                    '<table style="width:100%; border-collapse:collapse; font-size:12px; color:#161616;">',
                    '  <thead><tr style="background:#f4f4f4; text-align:left;"><th style="padding:6px 10px;">N°</th><th style="padding:6px 10px;">Description de la série</th><th style="padding:6px 10px;">Modalité</th><th style="padding:6px 10px; text-align:right;">Coupes</th></tr></thead>',
                    '  <tbody>' + seriesRows + '</tbody>',
                    '</table>'
                  ].join('');
                }
              } else {
                container.style.display = 'none';
                btn.textContent = 'Détails des séries ▼';
              }
            });
          });
        }

        // Modal upload handlers
        var openModalBtn = dom.querySelector('#btn-open-upload-modal');
        var closeModalBtn = dom.querySelector('#btn-close-upload-modal');
        var cancelModalBtn = dom.querySelector('#btn-cancel-upload');
        var modal = dom.querySelector('#dicom-upload-modal');
        var dropzone = dom.querySelector('#dicom-dropzone');
        var fileInput = dom.querySelector('#dicom-file-input');
        var submitBtn = dom.querySelector('#btn-submit-upload');
        var statusDiv = dom.querySelector('#upload-status');

        function openModal() { modal.style.display = 'flex'; statusDiv.innerHTML = ''; }
        function closeModal() { modal.style.display = 'none'; }

        if (openModalBtn) openModalBtn.addEventListener('click', openModal);
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

        var selectedFiles = [];
        if (dropzone && fileInput) {
          dropzone.addEventListener('click', function () { fileInput.click(); });
          fileInput.addEventListener('change', function () {
            selectedFiles = Array.from(fileInput.files);
            if (selectedFiles.length > 0) {
              statusDiv.innerHTML = '<span style="color:#005d5d; font-weight:600;">' + selectedFiles.length + ' fichier(s) DICOM sélectionné(s)</span>';
              submitBtn.disabled = false;
            }
          });
          dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.style.background = '#e5f6f6'; });
          dropzone.addEventListener('dragleave', function () { dropzone.style.background = '#f4f7f7'; });
          dropzone.addEventListener('drop', function (e) {
            e.preventDefault();
            dropzone.style.background = '#f4f7f7';
            if (e.dataTransfer && e.dataTransfer.files) {
              selectedFiles = Array.from(e.dataTransfer.files);
              statusDiv.innerHTML = '<span style="color:#005d5d; font-weight:600;">' + selectedFiles.length + ' fichier(s) prêt(s) à l\'importation</span>';
              submitBtn.disabled = false;
            }
          });
        }

        if (submitBtn) {
          submitBtn.addEventListener('click', async function () {
            submitBtn.disabled = true;
            statusDiv.innerHTML = 'Envoi vers Orthanc PACS en cours (0 / ' + selectedFiles.length + ')...';
            var uploaded = 0, errors = 0;
            for (var i = 0; i < selectedFiles.length; i++) {
              var f = selectedFiles[i];
              try {
                var ab = await f.arrayBuffer();
                var upRes = await fetch('/dicom-web/studies', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/dicom' },
                  body: ab
                });
                if (upRes.ok) uploaded++; else errors++;
              } catch (err) { errors++; }
              if (i % 10 === 0 || i === selectedFiles.length - 1) {
                statusDiv.innerHTML = 'Importation: ' + (i + 1) + ' / ' + selectedFiles.length + ' coupes envoyées...';
              }
            }
            statusDiv.innerHTML = '<span style="color:#24a148; font-weight:600;">Importation terminée (' + uploaded + ' réussies, ' + errors + ' erreurs). Actualisation...</span>';
            setTimeout(function () {
              closeModal();
              createImagingDashboardPage().mount(props);
            }, 1200);
          });
        }
      },
      unmount: async function (props) { if (props.domElement) props.domElement.innerHTML = ''; },
      update: async function () {}
    };
  }

  // ==========================================
  // 3. Summary Widget Component (Overview Tab)
  // ==========================================
  function createImagingSummaryWidget() {
    return {
      bootstrap: async function () {},
      mount: async function (props) {
        var patientUuid = getPatientUuid(props);
        var dom = props.domElement;
        dom.innerHTML = '<div style="padding:16px; background:#fff; border:1px solid #e0e0e0; border-radius:4px; font-size:13px; color:#525252;">Chargement imagerie PACS...</div>';

        var patient = await fetchPatientDetails(patientUuid);
        var hospId = getHospitalIdentifier(patient);
        if (!hospId) { dom.innerHTML = ''; return; }

        var rawStudies = await fetchDicomStudies(hospId);
        var studies = rawStudies.map(parseStudy);

        if (studies.length === 0) {
          dom.innerHTML = [
            '<div class="cds--tile" style="margin-bottom:16px; padding:16px; background:#fff; border:1px solid #e0e0e0; border-radius:4px;">',
            '  <div style="display:flex; justify-content:space-between; align-items:center;">',
            '    <div style="display:flex; align-items:center; gap:8px;">',
            '      <span style="font-size:18px;">🩻</span>',
            '      <strong style="font-size:14px; color:#161616;">Imagerie Médicale (PACS)</strong>',
            '    </div>',
            '    <span style="font-size:12px; color:#8d8d8d;">Aucun examen enregistré</span>',
            '  </div>',
            '</div>'
          ].join('');
          return;
        }

        var latest = studies[0];
        var ohifViewerUrl = '/ohif/viewer?StudyInstanceUIDs=' + encodeURIComponent(latest.uid);
        var ohifAiUrl = '/ohif-ai/viewer?StudyInstanceUIDs=' + encodeURIComponent(latest.uid);
        var badges = latest.modalities.map(getModalityBadge).join(' ');

        dom.innerHTML = [
          '<div class="cds--tile" style="margin-bottom:16px; padding:16px; background:#fff; border:1px solid #e0e0e0; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">',
          '  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">',
          '    <div style="display:flex; align-items:center; gap:8px;">',
          '      <span style="font-size:18px;">🩻</span>',
          '      <strong style="font-size:15px; color:#161616;">Imagerie Médicale (PACS)</strong>',
          '      <span style="font-size:12px; color:#525252; margin-left:8px;">(' + studies.length + ' examen' + (studies.length > 1 ? 's' : '') + ')</span>',
          '    </div>',
          '    <a href="/openmrs/spa/patient/' + patientUuid + '/chart/imaging" style="font-size:13px; color:#005d5d; font-weight:600; text-decoration:none;">',
          '      Voir tous les examens →',
          '    </a>',
          '  </div>',
          '  <div style="display:flex; justify-content:space-between; align-items:center; background:#f4f4f4; border-radius:6px; padding:12px 14px; flex-wrap:wrap; gap:10px;">',
          '    <div>',
          '      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">',
          badges,
          '        <strong style="font-size:14px; color:#161616;">' + latest.description + '</strong>',
          '      </div>',
          '      <div style="font-size:12px; color:#525252;">',
          '        Date: <strong>' + latest.date + '</strong> • ' + latest.seriesCount + ' séries • ' + latest.instanceCount + ' coupes DICOM',
          '      </div>',
          '    </div>',
          '    <div style="display:flex; gap:8px;">',
          '      <a href="' + ohifAiUrl + '" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:#6929c4; color:#fff; padding:6px 14px; border-radius:4px; font-size:12px; font-weight:600; text-decoration:none;">',
          '        <span>🧠 OHIF-AI (Segmentation) ↗</span>',
          '      </a>',
          '      <a href="' + ohifViewerUrl + '" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:#005d5d; color:#fff; padding:6px 14px; border-radius:4px; font-size:12px; font-weight:600; text-decoration:none;">',
          '        <span>👁️ OHIF ↗</span>',
          '      </a>',
          '    </div>',
          '  </div>',
          '</div>'
        ].join('');
      },
      unmount: async function (props) { if (props.domElement) props.domElement.innerHTML = ''; },
      update: async function () {}
    };
  }

  // ==========================================
  // 4. Clinical AI Assistant & Dictation Page
  // ==========================================
  function createAiAssistantDashboardPage() {
    return {
      bootstrap: async function () {},
      mount: async function (props) {
        var patientUuid = getPatientUuid(props);
        var dom = props.domElement;

        var patient = await fetchPatientDetails(patientUuid);
        var hospId = getHospitalIdentifier(patient) || 'Non spécifié';
        var patientName = patient && patient.display ? patient.display.split('-')[1] || patient.display : 'Patient';
        var age = patient && patient.person && patient.person.age ? patient.person.age : 45;
        var gender = patient && patient.person && patient.person.gender ? patient.person.gender : 'M';

        var recorder = new AudioRecorder();
        var recordInterval = null;
        var recordSeconds = 0;

        dom.innerHTML = [
          '<div style="padding:24px; font-family:IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">',
          '  <!-- En-tête principal -->',
          '  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">',
          '    <div>',
          '      <h2 style="font-size:22px; font-weight:600; color:#161616; margin:0 0 4px 0; display:flex; align-items:center; gap:8px;">',
          '        <span style="font-size:24px;">🧠</span> Assistant Clinique IA & Dictée Vocale Médicale',
          '      </h2>',
          '      <p style="font-size:13px; color:#525252; margin:0;">CHU Frantz Fanon Blida • Modèles sur site (MedGemma 4B & Qwen3-ASR) • Données sécurisées 100% locales</p>',
          '    </div>',
          '    <div style="display:flex; align-items:center; gap:8px; background:#edf5ff; border:1px solid #d0e2ff; padding:6px 14px; border-radius:16px;">',
          '      <span style="width:10px; height:10px; border-radius:50%; background:#24a148; display:inline-block; box-shadow:0 0 6px rgba(36,161,72,0.6);"></span>',
          '      <span style="font-size:13px; color:#0043ce; font-weight:600;">Serveur 2 IA Connecté (GPU RTX 5070 Ti)</span>',
          '    </div>',
          '  </div>',
          '',
          '  <!-- Bandeau Patient -->',
          '  <div style="background:#f4f4f4; border-radius:6px; padding:12px 16px; margin-bottom:20px; display:flex; gap:20px; align-items:center; flex-wrap:wrap;">',
          '    <div><span style="font-size:12px; color:#525252;">Patient:</span> <strong style="font-size:14px; color:#161616;">' + patientName + '</strong></div>',
          '    <div><span style="font-size:12px; color:#525252;">N° Dossier:</span> <strong style="font-size:14px; color:#005d5d;">' + hospId + '</strong></div>',
          '    <div><span style="font-size:12px; color:#525252;">Âge / Sexe:</span> <span style="font-size:13px; color:#161616;">' + age + ' ans (' + gender + ')</span></div>',
          '  </div>',
          '',
          '  <!-- Onglets de l\'assistant -->',
          '  <div style="display:flex; border-bottom:2px solid #e0e0e0; margin-bottom:24px; gap:4px;">',
          '    <button class="ai-tab-btn active" data-tab="tab-stt" style="padding:10px 18px; border:none; background:none; font-size:14px; font-weight:600; color:#005d5d; border-bottom:3px solid #005d5d; cursor:pointer;">🎙️ Dictée Vocale Directe</button>',
          '    <button class="ai-tab-btn" data-tab="tab-op-report" style="padding:10px 18px; border:none; background:none; font-size:14px; font-weight:600; color:#525252; border-bottom:3px solid transparent; cursor:pointer;">📝 Compte-rendu Opératoire</button>',
          '    <button class="ai-tab-btn" data-tab="tab-discharge" style="padding:10px 18px; border:none; background:none; font-size:14px; font-weight:600; color:#525252; border-bottom:3px solid transparent; cursor:pointer;">📋 Lettre de Sortie / Synthèse</button>',
          '    <button class="ai-tab-btn" data-tab="tab-chat" style="padding:10px 18px; border:none; background:none; font-size:14px; font-weight:600; color:#525252; border-bottom:3px solid transparent; cursor:pointer;">💬 Assistant Clinique MedGemma</button>',
          '  </div>',
          '',
          '  <!-- CONTENU DES ONGLETS -->',
          '  <div id="ai-tab-content">',
          '',
          '    <!-- 1. DICTÉE VOCALE -->',
          '    <div id="tab-stt" class="ai-tab-pane" style="display:block;">',
          '      <div style="background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">',
          '        <h3 style="font-size:16px; font-weight:600; color:#161616; margin:0 0 8px 0;">Dictée Vocale Médicale Intégrée (Modèle Qwen3-ASR)</h3>',
          '        <p style="font-size:13px; color:#525252; margin:0 0 20px 0;">Parlez naturellement en français. Le modèle intègre le lexique neurochirurgical spécifique du CHU de Blida (termes anatomiques, scores GCS, types de tumeurs, abords opératoires).</p>',
          '        ',
          '        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; flex-wrap:wrap;">',
          '          <button id="btn-toggle-recording" style="display:inline-flex; align-items:center; gap:8px; background:#005d5d; color:#fff; border:none; padding:12px 24px; border-radius:24px; font-size:14px; font-weight:600; cursor:pointer; box-shadow:0 2px 6px rgba(0,93,93,0.3); transition:background 0.2s;">',
          '            <span id="rec-icon" style="font-size:16px;">🎙️</span>',
          '            <span id="rec-label">Démarrer la dictée vocale</span>',
          '          </button>',
          '          <div id="rec-timer" style="display:none; font-size:14px; font-weight:600; color:#da1e28; align-items:center; gap:6px;">',
          '            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#da1e28; animation:pulse 1s infinite;"></span>',
          '            <span id="rec-timer-text">00:00</span> / 00:30 max',
          '          </div>',
          '          <span id="stt-status-msg" style="font-size:13px; color:#525252;">Microphone prêt</span>',
          '        </div>',
          '',
          '        <div style="margin-bottom:14px;">',
          '          <label style="display:block; font-size:13px; font-weight:600; color:#161616; margin-bottom:6px;">Texte transcrit :</label>',
          '          <textarea id="stt-transcript-result" rows="5" style="width:100%; border:1px solid #8d8d8d; border-radius:4px; padding:12px; font-size:14px; line-height:1.5; font-family:inherit; box-sizing:border-box;" placeholder="Le texte dicté apparaîtra automatiquement ici dès l\'arrêt de la capture vocale..."></textarea>',
          '        </div>',
          '        ',
          '        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">',
          '          <div style="font-size:12px; color:#525252;">💡 Vous pouvez modifier le texte avant de le copier ou de l\'insérer dans les observations.</div>',
          '          <div style="display:flex; gap:8px;">',
          '            <button id="btn-copy-stt" style="background:#f4f4f4; border:1px solid #c6c6c6; color:#161616; padding:8px 16px; border-radius:4px; font-size:13px; font-weight:600; cursor:pointer;">📋 Copier le texte</button>',
          '            <button id="btn-clear-stt" style="background:#fff; border:1px solid #e0e0e0; color:#da1e28; padding:8px 16px; border-radius:4px; font-size:13px; cursor:pointer;">Effacer</button>',
          '          </div>',
          '        </div>',
          '      </div>',
          '    </div>',
          '',
          '    <!-- 2. COMPTE-RENDU OPÉRATOIRE -->',
          '    <div id="tab-op-report" class="ai-tab-pane" style="display:none;">',
          '      <div style="background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">',
          '        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">',
          '          <h3 style="font-size:16px; font-weight:600; color:#161616; margin:0;">Générateur de Compte-rendu Opératoire Structuré (MedGemma)</h3>',
          '          <div style="display:flex; align-items:center; gap:8px;">',
          '            <label style="font-size:12px; color:#525252;">Modèle prédéfini :</label>',
          '            <select id="op-template-select" style="padding:6px 10px; border-radius:4px; border:1px solid #8d8d8d; font-size:13px;">',
          '              <option value="custom">-- Saisie libre personnalisée --</option>',
          '              <option value="meningioma">Craniotomie pour méningiome de la convexité</option>',
          '              <option value="hsdc">Évacuation d\'hématome sous-dural chronique</option>',
          '              <option value="dvp">Dérivation ventriculo-péritonéale (DVP)</option>',
          '              <option value="hernie">Hernie discale lombaire L4-L5 / Laminectomie</option>',
          '            </select>',
          '          </div>',
          '        </div>',
          '',
          '        <form id="op-report-form" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">',
          '          <div style="grid-column: span 2;">',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Intervention réalisée * :</label>',
          '            <input type="text" id="op-intervention" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" required />',
          '          </div>',
          '          <div>',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Indication opératoire * :</label>',
          '            <input type="text" id="op-indication" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" required />',
          '          </div>',
          '          <div>',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Voie d\'abord / Installation :</label>',
          '            <input type="text" id="op-abord" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" value="Voie coronale droite, décubitus dorsal tête tournée" />',
          '          </div>',
          '          <div>',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Chirurgien(s) opérateur(s) :</label>',
          '            <input type="text" id="op-surgeons" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" value="Pr. Lakhal / Dr. Benali" />',
          '          </div>',
          '          <div>',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Qualité d\'exérèse / Résultat per-opératoire :</label>',
          '            <input type="text" id="op-exerese" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" value="Exérèse macroscopiquement complète (Simpson 1)" />',
          '          </div>',
          '          <div style="grid-column: span 2;">',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Constatations et description du geste :</label>',
          '            <textarea id="op-geste" rows="4" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" placeholder="Détaillez les étapes opératoires ou utilisez la dictée vocale..."></textarea>',
          '          </div>',
          '          <div>',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Pertes sanguines estimées :</label>',
          '            <input type="text" id="op-blood" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" value="150 mL, sans transfusion" />',
          '          </div>',
          '          <div>',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Consignes et surveillance post-opératoire :</label>',
          '            <input type="text" id="op-consignes" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" value="Surveillance USI neurochirurgicale 24h, TDM cérébrale de contrôle à J1" />',
          '          </div>',
          '        </form>',
          '',
          '        <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">',
          '          <button id="btn-submit-op-report" style="background:#005d5d; color:#fff; border:none; padding:10px 22px; border-radius:4px; font-size:14px; font-weight:600; cursor:pointer;">',
          '            ✨ Rédiger le Compte-rendu avec MedGemma IA',
          '          </button>',
          '        </div>',
          '',
          '        <div id="op-report-result-box" style="display:none; margin-top:24px; border-top:1px solid #e0e0e0; padding-top:20px;">',
          '          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">',
          '            <h4 style="margin:0; font-size:15px; font-weight:600; color:#005d5d;">Brouillon généré par MedGemma (CHU Blida) :</h4>',
          '            <div style="display:flex; gap:8px;">',
          '              <button id="btn-copy-op-draft" style="background:#005d5d; color:#fff; border:none; padding:6px 14px; border-radius:4px; font-size:12px; font-weight:600; cursor:pointer;">📋 Copier le compte-rendu</button>',
          '            </div>',
          '          </div>',
          '          <pre id="op-report-text" style="background:#f4f7f7; border:1px solid #005d5d; border-radius:6px; padding:16px; font-family:Courier New, monospace; font-size:13px; line-height:1.5; white-space:pre-wrap; color:#161616; max-height:400px; overflow-y:auto;"></pre>',
          '          <div id="op-report-meta" style="font-size:11px; color:#525252; margin-top:6px;"></div>',
          '        </div>',
          '      </div>',
          '    </div>',
          '',
          '    <!-- 3. LETTRE DE SORTIE -->',
          '    <div id="tab-discharge" class="ai-tab-pane" style="display:none;">',
          '      <div style="background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">',
          '        <h3 style="font-size:16px; font-weight:600; color:#161616; margin:0 0 16px 0;">Générateur de Lettre de Sortie & Synthèse d\'Hospitalisation (MedGemma)</h3>',
          '        <form id="discharge-form" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">',
          '          <div>',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Diagnostic principal de sortie * :</label>',
          '            <input type="text" id="dc-diag" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" value="Méningiome frontal droit opéré" required />',
          '          </div>',
          '          <div>',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Dates d\'hospitalisation :</label>',
          '            <input type="text" id="dc-dates" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" value="Admission: J-5 / Sortie: ce jour" />',
          '          </div>',
          '          <div style="grid-column: span 2;">',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Résumé de l\'hospitalisation et chirurgie réalisée * :</label>',
          '            <textarea id="dc-resume" rows="3" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" required>Patient admis pour prise en charge d\'un processus expansif frontal droit. Intervention chirurgicale réalisée : craniotomie et exérèse tumorale complète sans complication per-opératoire.</textarea>',
          '          </div>',
          '          <div style="grid-column: span 2;">',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Évolution clinique et état neurologique de sortie :</label>',
          '            <textarea id="dc-evolution" rows="2" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;">Suites opératoires simples. Examen neurologique à la sortie : patient conscient orienté (GCS 15/15), aucun déficit moteur ou sensitif, cicatrice opératoire propre et sèche.</textarea>',
          '          </div>',
          '          <div style="grid-column: span 2;">',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Traitement de sortie prescrit :</label>',
          '            <input type="text" id="dc-treatment" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" value="Paracétamol 1g si douleur, soins de pansement tous les 2 jours, repos 30 jours." />',
          '          </div>',
          '          <div style="grid-column: span 2;">',
          '            <label style="display:block; font-size:12px; font-weight:600; color:#161616; margin-bottom:4px;">Consignes de suivi et rendez-vous :</label>',
          '            <input type="text" id="dc-suivi" style="width:100%; padding:8px 10px; border:1px solid #8d8d8d; border-radius:4px; font-size:13px; box-sizing:border-box;" value="Ablation des fils à J12 en externe. Consultation de contrôle à 1 mois avec IRM cérébrale." />',
          '          </div>',
          '        </form>',
          '',
          '        <div style="margin-top:20px; display:flex; justify-content:flex-end;">',
          '          <button id="btn-submit-discharge" style="background:#005d5d; color:#fff; border:none; padding:10px 22px; border-radius:4px; font-size:14px; font-weight:600; cursor:pointer;">',
          '            ✨ Rédiger la Lettre de Sortie avec MedGemma IA',
          '          </button>',
          '        </div>',
          '',
          '        <div id="discharge-result-box" style="display:none; margin-top:24px; border-top:1px solid #e0e0e0; padding-top:20px;">',
          '          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">',
          '            <h4 style="margin:0; font-size:15px; font-weight:600; color:#005d5d;">Lettre de Sortie générée par MedGemma :</h4>',
          '            <button id="btn-copy-dc-draft" style="background:#005d5d; color:#fff; border:none; padding:6px 14px; border-radius:4px; font-size:12px; font-weight:600; cursor:pointer;">📋 Copier la lettre</button>',
          '          </div>',
          '          <pre id="discharge-text" style="background:#f4f7f7; border:1px solid #005d5d; border-radius:6px; padding:16px; font-family:Courier New, monospace; font-size:13px; line-height:1.5; white-space:pre-wrap; color:#161616; max-height:400px; overflow-y:auto;"></pre>',
          '          <div id="discharge-meta" style="font-size:11px; color:#525252; margin-top:6px;"></div>',
          '        </div>',
          '      </div>',
          '    </div>',
          '',
          '    <!-- 4. CHAT CLINIQUE MEDGEMMA -->',
          '    <div id="tab-chat" class="ai-tab-pane" style="display:none;">',
          '      <div style="background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.05); display:flex; flex-direction:column; height:580px;">',
          '        <div style="margin-bottom:12px;">',
          '          <h3 style="font-size:16px; font-weight:600; color:#161616; margin:0 0 4px 0;">Discussion Clinique avec MedGemma 4B</h3>',
          '          <p style="font-size:13px; color:#525252; margin:0;">Posez des questions sur les classifications neurochirurgicales, les posologies, ou demandez une synthèse clinique.</p>',
          '        </div>',
          '        ',
          '        <!-- Suggestions rapides -->',
          '        <div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;">',
          '          <button class="chat-chip" data-prompt="Quelles sont les indications opératoires urgentes dans l\'hématome sous-dural chronique ?" style="background:#edf5ff; border:1px solid #d0e2ff; color:#0043ce; border-radius:14px; padding:4px 10px; font-size:12px; cursor:pointer;">Indications HSDC</button>',
          '          <button class="chat-chip" data-prompt="Rappelle-moi les critères de la classification de Spetzler-Martin pour les malformations artério-veineuses cérébrales." style="background:#edf5ff; border:1px solid #d0e2ff; color:#0043ce; border-radius:14px; padding:4px 10px; font-size:12px; cursor:pointer;">Score Spetzler-Martin MAV</button>',
          '          <button class="chat-chip" data-prompt="Quelle est la conduite à tenir devant un score de Glasgow à 8 post-traumatique ?" style="background:#edf5ff; border:1px solid #d0e2ff; color:#0043ce; border-radius:14px; padding:4px 10px; font-size:12px; cursor:pointer;">CAT Glasgow 8</button>',
          '          <button class="chat-chip" data-prompt="Quel est le protocole d\'antibiothérapie prophylactique pour une craniotomie programmée ?" style="background:#edf5ff; border:1px solid #d0e2ff; color:#0043ce; border-radius:14px; padding:4px 10px; font-size:12px; cursor:pointer;">Antibioprophylaxie crâne</button>',
          '        </div>',
          '',
          '        <!-- Zone des messages -->',
          '        <div id="chat-messages-container" style="flex:1; border:1px solid #e0e0e0; border-radius:6px; background:#fbfbfb; padding:16px; overflow-y:auto; margin-bottom:14px; display:flex; flex-direction:column; gap:12px;">',
          '          <div style="background:#e8f4f4; border-radius:8px; padding:12px; align-self:flex-start; max-width:85%;">',
          '            <div style="font-size:11px; font-weight:600; color:#005d5d; margin-bottom:4px;">Assistant MedGemma • Neurochirurgie CHU Blida</div>',
          '            <div style="font-size:13px; color:#161616; line-height:1.4;">Bonjour Docteur. Je suis l\'assistant neurochirurgical local de garde. Comment puis-je vous aider pour ce patient ?</div>',
          '          </div>',
          '        </div>',
          '',
          '        <!-- Zone de saisie -->',
          '        <div style="display:flex; gap:8px;">',
          '          <input type="text" id="chat-input-text" style="flex:1; padding:10px 14px; border:1px solid #8d8d8d; border-radius:4px; font-size:14px;" placeholder="Posez une question clinique ou formulez une demande..." />',
          '          <button id="btn-chat-mic" title="Dicter la question" style="background:#f4f4f4; border:1px solid #c6c6c6; border-radius:4px; padding:10px 14px; font-size:16px; cursor:pointer;">🎙️</button>',
          '          <button id="btn-chat-send" style="background:#005d5d; color:#fff; border:none; padding:10px 20px; border-radius:4px; font-size:14px; font-weight:600; cursor:pointer;">Envoyer ↵</button>',
          '        </div>',
          '      </div>',
          '    </div>',
          '',
          '  </div>',
          '</div>'
        ].join('');

        // --- GESTION DES ONGLETS ---
        var tabButtons = dom.querySelectorAll('.ai-tab-btn');
        var tabPanes = dom.querySelectorAll('.ai-tab-pane');
        tabButtons.forEach(function (btn) {
          btn.addEventListener('click', function () {
            var targetTab = btn.getAttribute('data-tab');
            tabButtons.forEach(function (b) {
              b.classList.remove('active');
              b.style.color = '#525252';
              b.style.borderBottomColor = 'transparent';
            });
            tabPanes.forEach(function (p) { p.style.display = 'none'; });
            btn.classList.add('active');
            btn.style.color = '#005d5d';
            btn.style.borderBottomColor = '#005d5d';
            dom.querySelector('#' + targetTab).style.display = 'block';
          });
        });

        // --- ONGLET 1: DICTÉE VOCALE MÉDICALE ---
        var toggleRecBtn = dom.querySelector('#btn-toggle-recording');
        var recIcon = dom.querySelector('#rec-icon');
        var recLabel = dom.querySelector('#rec-label');
        var recTimer = dom.querySelector('#rec-timer');
        var recTimerText = dom.querySelector('#rec-timer-text');
        var sttStatusMsg = dom.querySelector('#stt-status-msg');
        var sttResult = dom.querySelector('#stt-transcript-result');
        var copySttBtn = dom.querySelector('#btn-copy-stt');
        var clearSttBtn = dom.querySelector('#btn-clear-stt');

        if (toggleRecBtn) {
          toggleRecBtn.addEventListener('click', async function () {
            if (!recorder.isRecording) {
              try {
                await recorder.start();
                toggleRecBtn.style.background = '#da1e28';
                recIcon.textContent = '⏹️';
                recLabel.textContent = 'Arrêter l\'enregistrement';
                recTimer.style.display = 'inline-flex';
                recordSeconds = 0;
                sttStatusMsg.textContent = 'Enregistrement en cours... Parlez dans le microphone.';
                sttStatusMsg.style.color = '#da1e28';

                recordInterval = setInterval(function () {
                  recordSeconds++;
                  var min = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
                  var sec = String(recordSeconds % 60).padStart(2, '0');
                  recTimerText.textContent = min + ':' + sec;
                  if (recordSeconds >= 30) {
                    toggleRecBtn.click();
                  }
                }, 1000);
              } catch (e) {
                alert('Impossible d\'accéder au microphone : ' + e.message);
              }
            } else {
              clearInterval(recordInterval);
              toggleRecBtn.style.background = '#005d5d';
              recIcon.textContent = '🎙️';
              recLabel.textContent = 'Démarrer la dictée vocale';
              recTimer.style.display = 'none';
              sttStatusMsg.textContent = 'Transcription par Qwen3-ASR (Serveur 2)...';
              sttStatusMsg.style.color = '#6929c4';

              try {
                var wavBlob = await recorder.stop();
                var prompt = 'Neurochirurgie, CHU Blida, patient ' + patientName;
                var res = await apiTranscribeAudio(wavBlob, prompt);
                if (res.text) {
                  var current = sttResult.value.trim();
                  sttResult.value = current ? current + ' ' + res.text : res.text;
                  sttStatusMsg.textContent = 'Transcription réussie (' + (res.duration_seconds || recordSeconds) + 's).';
                  sttStatusMsg.style.color = '#24a148';
                } else {
                  sttStatusMsg.textContent = 'Aucun son ou parole distincte détectée.';
                  sttStatusMsg.style.color = '#525252';
                }
              } catch (err) {
                sttStatusMsg.textContent = 'Erreur : ' + err.message;
                sttStatusMsg.style.color = '#da1e28';
              }
            }
          });
        }

        if (copySttBtn) {
          copySttBtn.addEventListener('click', function () {
            if (!sttResult.value) return;
            navigator.clipboard.writeText(sttResult.value);
            copySttBtn.textContent = '✅ Copié !';
            setTimeout(function () { copySttBtn.textContent = '📋 Copier le texte'; }, 2000);
          });
        }

        if (clearSttBtn) {
          clearSttBtn.addEventListener('click', function () {
            sttResult.value = '';
            sttStatusMsg.textContent = 'Zone effacée';
          });
        }

        // --- ONGLET 2: COMPTE-RENDU OPÉRATOIRE ---
        var opTemplateSelect = dom.querySelector('#op-template-select');
        var submitOpBtn = dom.querySelector('#btn-submit-op-report');
        var opResultBox = dom.querySelector('#op-report-result-box');
        var opReportText = dom.querySelector('#op-report-text');
        var opReportMeta = dom.querySelector('#op-report-meta');
        var copyOpBtn = dom.querySelector('#btn-copy-op-draft');

        var opTemplates = {
          meningioma: {
            intervention: 'Craniotomie et exérèse de méningiome de la convexité frontale droite',
            indication: 'Méningiome frontal droit symptomatique (crises comitiales, céphalées)',
            abord: 'Voie coronale droite, décubitus dorsal tête tournée à gauche',
            geste: 'Incision coronale, volet osseux fronto-pariétal centré sur la lésion. Découverte d\'un méningiome extra-axial fermement attaché à la dure-mère. Coagulation de l\'attache méningée, dévascularisation et exérèse monobloc complète de la tumeur avec marge durale. Hémostase soignée au surgicel.',
            exerese: 'Exérèse macroscopiquement complète (Grade 1 de Simpson)',
            consignes: 'Surveillance post-opératoire USI neurochirurgie 24h, TDM cérébrale de contrôle à J1'
          },
          hsdc: {
            intervention: 'Évacuation d\'un hématome sous-dural chronique hémisphérique gauche par deux trous de trépan',
            indication: 'Hématome sous-dural chronique gauche compressif avec déviation de la ligne médiane de 7mm',
            abord: 'Décubitus dorsal tête tournée à droite, deux trous de trépan frontal et pariétal',
            geste: 'Réalisation de deux trous de trépan. Incision de la dure-mère et des membranes hématomiques. Issue sous pression d\'un liquide noirâtre en huile de moteur. Lavage abondant et doux au sérum physiologique tiède jusqu\'à obtention d\'un liquide clair. Mise en place d\'un drain sous-dural déclive.',
            exerese: 'Évacuation complète de la collection hématomique',
            consignes: 'Patient maintenu à plat strict 48h, hydratation per os abondante, ablation du drain à J2'
          },
          dvp: {
            intervention: 'Dérivation ventriculo-péritonéale (DVP) avec valve à pression moyenne',
            indication: 'Hydrocéphalie à pression normale (triade d\'Adams et Hakim)',
            abord: 'Point de Kocher frontal droit et incision sous-ombilicale paramédiane',
            geste: 'Ponction ventriculaire frontale droite au premier essai, issue d\'un LCR clair sous pression modérée. Connexion du cathéter ventriculaire au boîtier de valve. Tunnelisation sous-cutanée du cathéter distal. Incision abdominale, ouverture péritonéale et montée du cathéter péritonéal sans résistance.',
            exerese: 'Matériel implanté : Valve DVP Integra Chhabra moyenne pression',
            consignes: 'Radiographie de contrôle du trajet de dérivation (crâne, thorax, abdomen) à J1'
          },
          hernie: {
            intervention: 'Discectomie microchirurgicale L4-L5 gauche',
            indication: 'Lombosciatique gauche L5 hyperalgique résistante au traitement médical bien conduit',
            abord: 'Décubitus ventral sur cadre, abord médian postérieur lombaire L4-L5',
            geste: 'Abord postérieur centré sous scopie sur l\'espace L4-L5. Fenestration ligamentaire et résection du ligament jaune. Rétraction médiale de la racine L5 gauche. Découverte d\'une volumineuse hernie discale sous-ligamentaire exclue. Discectomie microchirurgicale complète, décompression radiculaire parfaite.',
            exerese: 'Exérèse complète du séquestre discal L4-L5',
            consignes: 'Lever au premier jour post-opératoire avec kinésithérapie, port de lombostat 4 semaines'
          }
        };

        if (opTemplateSelect) {
          opTemplateSelect.addEventListener('change', function () {
            var t = opTemplates[opTemplateSelect.value];
            if (t) {
              dom.querySelector('#op-intervention').value = t.intervention;
              dom.querySelector('#op-indication').value = t.indication;
              dom.querySelector('#op-abord').value = t.abord;
              dom.querySelector('#op-geste').value = t.geste;
              dom.querySelector('#op-exerese').value = t.exerese;
              dom.querySelector('#op-consignes').value = t.consignes;
            }
          });
        }

        if (submitOpBtn) {
          submitOpBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            var intervention = dom.querySelector('#op-intervention').value.trim();
            var indication = dom.querySelector('#op-indication').value.trim();
            if (!intervention || !indication) {
              alert('Veuillez renseigner au minimum l\'intervention et l\'indication.');
              return;
            }

            submitOpBtn.disabled = true;
            submitOpBtn.textContent = '⏳ Rédaction par MedGemma 4B en cours...';

            var payload = {
              patient_id: hospId,
              patient_name: patientName,
              age: age,
              gender: gender,
              intervention: intervention,
              indication: indication,
              diagnostic_preop: indication,
              voie_abord: dom.querySelector('#op-abord').value.trim(),
              operateurs: dom.querySelector('#op-surgeons').value.trim(),
              qualite_exerese: dom.querySelector('#op-exerese').value.trim(),
              description_geste: dom.querySelector('#op-geste').value.trim(),
              consignes_postop: dom.querySelector('#op-consignes').value.trim()
            };

            try {
              var result = await apiDraftOperativeReport(payload);
              opReportText.textContent = result.draft_text;
              opReportMeta.textContent = 'Généré par ' + result.model_used + ' en ' + (result.latency_ms / 1000).toFixed(2) + 's sur GPU RTX 5070 Ti.';
              opResultBox.style.display = 'block';
              opResultBox.scrollIntoView({ behavior: 'smooth' });
            } catch (err) {
              alert('Erreur lors de la génération : ' + err.message);
            } finally {
              submitOpBtn.disabled = false;
              submitOpBtn.textContent = '✨ Rédiger le Compte-rendu avec MedGemma IA';
            }
          });
        }

        if (copyOpBtn) {
          copyOpBtn.addEventListener('click', function () {
            navigator.clipboard.writeText(opReportText.textContent);
            copyOpBtn.textContent = '✅ Compte-rendu copié !';
            setTimeout(function () { copyOpBtn.textContent = '📋 Copier le compte-rendu'; }, 2000);
          });
        }

        // --- ONGLET 3: LETTRE DE SORTIE ---
        var submitDcBtn = dom.querySelector('#btn-submit-discharge');
        var dcResultBox = dom.querySelector('#discharge-result-box');
        var dcReportText = dom.querySelector('#discharge-text');
        var dcReportMeta = dom.querySelector('#discharge-meta');
        var copyDcBtn = dom.querySelector('#btn-copy-dc-draft');

        if (submitDcBtn) {
          submitDcBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            var diag = dom.querySelector('#dc-diag').value.trim();
            var resume = dom.querySelector('#dc-resume').value.trim();
            if (!diag || !resume) {
              alert('Veuillez renseigner le diagnostic et le résumé.');
              return;
            }

            submitDcBtn.disabled = true;
            submitDcBtn.textContent = '⏳ Rédaction par MedGemma en cours...';

            var payload = {
              patient_id: hospId,
              patient_name: patientName,
              age: age,
              gender: gender,
              diagnostic_principal: diag,
              resume_hospitalisation: resume,
              evolution_clinique: dom.querySelector('#dc-evolution').value.trim(),
              traitement_sortie: dom.querySelector('#dc-treatment').value.trim(),
              consignes_et_suivi: dom.querySelector('#dc-suivi').value.trim()
            };

            try {
              var result = await apiDraftDischargeLetter(payload);
              dcReportText.textContent = result.draft_text;
              dcReportMeta.textContent = 'Généré par ' + result.model_used + ' en ' + (result.latency_ms / 1000).toFixed(2) + 's sur GPU RTX 5070 Ti.';
              dcResultBox.style.display = 'block';
              dcResultBox.scrollIntoView({ behavior: 'smooth' });
            } catch (err) {
              alert('Erreur lors de la génération : ' + err.message);
            } finally {
              submitDcBtn.disabled = false;
              submitDcBtn.textContent = '✨ Rédiger la Lettre de Sortie avec MedGemma IA';
            }
          });
        }

        if (copyDcBtn) {
          copyDcBtn.addEventListener('click', function () {
            navigator.clipboard.writeText(dcReportText.textContent);
            copyDcBtn.textContent = '✅ Lettre copiée !';
            setTimeout(function () { copyDcBtn.textContent = '📋 Copier la lettre'; }, 2000);
          });
        }

        // --- ONGLET 4: CHAT CLINIQUE MEDGEMMA ---
        var chatInput = dom.querySelector('#chat-input-text');
        var chatSendBtn = dom.querySelector('#btn-chat-send');
        var chatMicBtn = dom.querySelector('#btn-chat-mic');
        var chatContainer = dom.querySelector('#chat-messages-container');
        var chatChips = dom.querySelectorAll('.chat-chip');
        var conversationHistory = [];

        function appendChatMessage(role, text) {
          var isUser = role === 'user';
          var msgDiv = document.createElement('div');
          msgDiv.style.borderRadius = '8px';
          msgDiv.style.padding = '12px';
          msgDiv.style.maxWidth = '85%';
          msgDiv.style.lineHeight = '1.4';
          msgDiv.style.fontSize = '13px';
          msgDiv.style.alignSelf = isUser ? 'flex-end' : 'flex-start';
          msgDiv.style.background = isUser ? '#005d5d' : '#e8f4f4';
          msgDiv.style.color = isUser ? '#fff' : '#161616';

          var roleHeader = document.createElement('div');
          roleHeader.style.fontSize = '11px';
          roleHeader.style.fontWeight = '600';
          roleHeader.style.marginBottom = '4px';
          roleHeader.style.color = isUser ? '#c6e7e7' : '#005d5d';
          roleHeader.textContent = isUser ? 'Dr. ' + (patientName ? 'Médecin traitant' : 'Praticien') : 'Assistant MedGemma 4B';

          var bodyDiv = document.createElement('div');
          bodyDiv.style.whiteSpace = 'pre-wrap';
          bodyDiv.textContent = text;

          msgDiv.appendChild(roleHeader);
          msgDiv.appendChild(bodyDiv);
          chatContainer.appendChild(msgDiv);
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        async function handleSendChat(text) {
          var q = (text || chatInput.value).trim();
          if (!q) return;
          chatInput.value = '';
          appendChatMessage('user', q);
          conversationHistory.push({ role: 'user', content: q });

          var patientContext = 'Patient: ' + patientName + ', Dossier: ' + hospId + ', Âge: ' + age + ' ans, Sexe: ' + gender;
          
          var loadingDiv = document.createElement('div');
          loadingDiv.style.alignSelf = 'flex-start';
          loadingDiv.style.fontSize = '12px';
          loadingDiv.style.color = '#525252';
          loadingDiv.style.fontStyle = 'italic';
          loadingDiv.id = 'chat-loading-indicator';
          loadingDiv.textContent = 'MedGemma réfléchit...';
          chatContainer.appendChild(loadingDiv);
          chatContainer.scrollTop = chatContainer.scrollHeight;

          try {
            var res = await apiChatAssistant(conversationHistory, patientContext);
            var loader = dom.querySelector('#chat-loading-indicator');
            if (loader) loader.remove();
            appendChatMessage('assistant', res.response);
            conversationHistory.push({ role: 'assistant', content: res.response });
          } catch (err) {
            conversationHistory.pop();
            var loaderErr = dom.querySelector('#chat-loading-indicator');
            if (loaderErr) loaderErr.remove();
            appendChatMessage('assistant', 'Désolé, une erreur est survenue : ' + err.message);
          }
        }

        if (chatSendBtn) {
          chatSendBtn.addEventListener('click', function () { handleSendChat(); });
        }
        if (chatInput) {
          chatInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') handleSendChat();
          });
        }
        chatChips.forEach(function (chip) {
          chip.addEventListener('click', function () {
            handleSendChat(chip.getAttribute('data-prompt'));
          });
        });

        if (chatMicBtn) {
          var chatRecorder = new AudioRecorder();
          chatMicBtn.addEventListener('click', async function () {
            if (!chatRecorder.isRecording) {
              try {
                await chatRecorder.start();
                chatMicBtn.textContent = '⏹️';
                chatMicBtn.style.background = '#da1e28';
                chatMicBtn.style.color = '#fff';
              } catch (e) { alert('Microphone inaccessible : ' + e.message); }
            } else {
              chatMicBtn.textContent = '⏳';
              try {
                var blob = await chatRecorder.stop();
                chatMicBtn.textContent = '🎙️';
                chatMicBtn.style.background = '#f4f4f4';
                chatMicBtn.style.color = '#161616';
                var sttRes = await apiTranscribeAudio(blob);
                if (sttRes.text) {
                  chatInput.value = sttRes.text;
                }
              } catch (err) {
                chatMicBtn.textContent = '🎙️';
                chatMicBtn.style.background = '#f4f4f4';
                chatMicBtn.style.color = '#161616';
                alert('Erreur dictée : ' + err.message);
              }
            }
          });
        }

      },
      unmount: async function (props) { if (props.domElement) props.domElement.innerHTML = ''; },
      update: async function () {}
    };
  }

  // ==========================================
  // Export Single-Spa & Module Federation
  // ==========================================
  window._openmrs_esm_neuro_imaging_app = {
    init: function () {
      return Promise.resolve();
    },
    get: function (moduleName) {
      return Promise.resolve(function () {
        return {
          imagingDashboardLink: createImagingDashboardLink,
          imagingDashboardPage: createImagingDashboardPage,
          imagingSummaryWidget: createImagingSummaryWidget,
          aiAssistantDashboardLink: createAiAssistantDashboardLink,
          aiAssistantDashboardPage: createAiAssistantDashboardPage,
        };
      });
    }
  };

})();
