/**
 * CHU Frantz Fanon Blida - Service de Neurochirurgie
 * Micro-frontend: @openmrs/esm-neuro-imaging-app
 * Intégration PACS Orthanc & Visualiseur OHIF Viewer pour OpenMRS 3.x
 */
(function () {
  'use strict';

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

  async function fetchDicomStudies(patientId) {
    if (!patientId) return [];
    try {
      var url = '/dicom-web/studies?PatientID=' + encodeURIComponent(patientId);
      var res = await fetch(url);
      if (!res.ok) {
        // Fallback: fetch all and filter client side
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

  // 1. Sidebar Dashboard Link Component
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
            if (window.singleSpaNavigate) {
              window.singleSpaNavigate(targetUrl);
            } else {
              window.history.pushState({}, '', targetUrl);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          });
        }
      },
      unmount: async function (props) {
        if (props.domElement) props.domElement.innerHTML = '';
      },
      update: async function () {}
    };
  }

  // 2. Full Imaging Dashboard Page Component
  function createImagingDashboardPage() {
    return {
      bootstrap: async function () {},
      mount: async function (props) {
        var patientUuid = getPatientUuid(props);
        var dom = props.domElement;

        dom.innerHTML = [
          '<div style="padding: 24px; font-family: IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">',
          '  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">',
          '    <div>',
          '      <h2 style="font-size:20px; font-weight:600; color:#161616; margin:0 0 4px 0;">Imagerie Médicale & PACS</h2>',
          '      <p style="font-size:13px; color:#525252; margin:0;">CHU Frantz Fanon Blida • Service de Neurochirurgie • Connecteur Orthanc DICOMweb</p>',
          '    </div>',
          '    <div style="display:flex; gap:10px;">',
          '      <a href="/ohif/" target="_blank" class="cds--btn cds--btn--secondary cds--btn--sm" style="display:inline-flex; align-items:center; text-decoration:none; padding:8px 14px; background:#393939; color:#fff; border-radius:4px; font-size:13px; font-weight:600;">',
          '        <span>Station OHIF Complète ↗</span>',
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
          '      <button id="btn-cancel-upload" class="cds--btn cds--btn--secondary" style="border:1px solid #c6c6c6; background:#fff; color:#161616; padding:8px 16px; border-radius:4px; font-size:13px; cursor:pointer;">Fermer</button>',
          '      <button id="btn-submit-upload" class="cds--btn cds--btn--primary" style="border:none; background:#005d5d; color:#fff; padding:8px 16px; border-radius:4px; font-size:13px; cursor:pointer;" disabled>Démarrer l\'importation</button>',
          '    </div>',
          '  </div>',
          '</div>'
        ].join('');

        var modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = modalHtml;
        dom.appendChild(modalWrapper);

        // Fetch patient & studies
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

        // Render header banner
        var bannerHtml = [
          '<div style="background:#f4f4f4; border-radius:6px; padding:12px 16px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">',
          '  <div style="display:flex; gap:20px; align-items:center;">',
          '    <div><span style="font-size:12px; color:#525252;">Patient:</span> <strong style="font-size:14px; color:#161616;">' + patientName + '</strong></div>',
          '    <div><span style="font-size:12px; color:#525252;">N° Dossier:</span> <strong style="font-size:14px; color:#005d5d;">' + hospId + '</strong></div>',
          ninId ? '    <div><span style="font-size:12px; color:#525252;">NIN:</span> <span style="font-size:13px; color:#161616;">' + ninId + '</span></div>' : '',
          '  </div>',
          '  <div style="display:flex; align-items:center; gap:6px;">',
          '    <span style="width:8px; height:8px; border-radius:50%; background:#24a148; display:inline-block;"></span>',
          '    <span style="font-size:12px; color:#161616; font-weight:600;">Orthanc PACS Actif</span>',
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
          var cardsHtml = studies.map(function (s, idx) {
            var badges = s.modalities.map(getModalityBadge).join(' ');
            var ohifViewerUrl = '/ohif/viewer?StudyInstanceUIDs=' + encodeURIComponent(s.uid);

            return [
              '<div class="imaging-study-card" style="background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:18px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06); transition:box-shadow 0.2s;" onmouseover="this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.12)\'" onmouseout="this.style.boxShadow=\'0 1px 3px rgba(0,0,0,0.06)\'">',
              '  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">',
              '    <div>',
              '      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">',
              badges,
              '        <span style="font-size:13px; color:#525252; font-weight:600;">Date: ' + s.date + '</span>',
              '      </div>',
              '      <h3 style="font-size:17px; font-weight:600; color:#161616; margin:0 0 6px 0;">' + s.description + '</h3>',
              '      <div style="font-size:13px; color:#525252;">Volume: <strong>' + s.seriesCount + ' séries</strong> • <strong>' + s.instanceCount + ' coupes DICOM</strong></div>',
              '    </div>',
              '    <div style="display:flex; gap:8px;">',
              '      <a href="' + ohifViewerUrl + '" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:#005d5d; color:#fff; padding:8px 16px; border-radius:4px; font-size:13px; font-weight:600; text-decoration:none; box-shadow:0 1px 3px rgba(0,0,0,0.1); cursor:pointer;">',
              '        <span>👁️ Ouvrir dans OHIF Viewer ↗</span>',
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

        // Wire modal handlers
        var openModalBtn = dom.querySelector('#btn-open-upload-modal');
        var closeModalBtn = dom.querySelector('#btn-close-upload-modal');
        var cancelModalBtn = dom.querySelector('#btn-cancel-upload');
        var modal = dom.querySelector('#dicom-upload-modal');
        var dropzone = dom.querySelector('#dicom-dropzone');
        var fileInput = dom.querySelector('#dicom-file-input');
        var submitBtn = dom.querySelector('#btn-submit-upload');
        var statusDiv = dom.querySelector('#upload-status');

        function openModal() {
          modal.style.display = 'flex';
          statusDiv.innerHTML = '';
        }
        function closeModal() {
          modal.style.display = 'none';
        }

        if (openModalBtn) openModalBtn.addEventListener('click', openModal);
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

        var selectedFiles = [];

        if (dropzone && fileInput) {
          dropzone.addEventListener('click', function () {
            fileInput.click();
          });

          fileInput.addEventListener('change', function () {
            selectedFiles = Array.from(fileInput.files);
            if (selectedFiles.length > 0) {
              statusDiv.innerHTML = '<span style="color:#005d5d; font-weight:600;">' + selectedFiles.length + ' fichier(s) DICOM sélectionné(s)</span>';
              submitBtn.disabled = false;
            }
          });

          dropzone.addEventListener('dragover', function (e) {
            e.preventDefault();
            dropzone.style.background = '#e5f6f6';
          });
          dropzone.addEventListener('dragleave', function () {
            dropzone.style.background = '#f4f7f7';
          });
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

            var uploaded = 0;
            var errors = 0;

            for (var i = 0; i < selectedFiles.length; i++) {
              var f = selectedFiles[i];
              try {
                var ab = await f.arrayBuffer();
                var upRes = await fetch('/dicom-web/studies', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/dicom' },
                  body: ab
                });
                if (upRes.ok) uploaded++;
                else errors++;
              } catch (err) {
                errors++;
              }
              if (i % 10 === 0 || i === selectedFiles.length - 1) {
                statusDiv.innerHTML = 'Importation: ' + (i + 1) + ' / ' + selectedFiles.length + ' coupes envoyées...';
              }
            }

            statusDiv.innerHTML = '<span style="color:#24a148; font-weight:600;">Importation terminée (' + uploaded + ' réussies, ' + errors + ' erreurs). Actualisation...</span>';
            setTimeout(function () {
              closeModal();
              // Re-mount page
              createImagingDashboardPage().mount(props);
            }, 1200);
          });
        }
      },
      unmount: async function (props) {
        if (props.domElement) props.domElement.innerHTML = '';
      },
      update: async function () {}
    };
  }

  // 3. Summary Widget Component (for the Main Patient Summary tab)
  function createImagingSummaryWidget() {
    return {
      bootstrap: async function () {},
      mount: async function (props) {
        var patientUuid = getPatientUuid(props);
        var dom = props.domElement;

        dom.innerHTML = '<div style="padding:16px; background:#fff; border:1px solid #e0e0e0; border-radius:4px; font-size:13px; color:#525252;">Chargement imagerie PACS...</div>';

        var patient = await fetchPatientDetails(patientUuid);
        var hospId = getHospitalIdentifier(patient);
        if (!hospId) {
          dom.innerHTML = '';
          return;
        }

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
          '  <div style="display:flex; justify-content:space-between; align-items:center; background:#f4f4f4; border-radius:6px; padding:12px 14px;">',
          '    <div>',
          '      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">',
          badges,
          '        <strong style="font-size:14px; color:#161616;">' + latest.description + '</strong>',
          '      </div>',
          '      <div style="font-size:12px; color:#525252;">',
          '        Date: <strong>' + latest.date + '</strong> • ' + latest.seriesCount + ' séries • ' + latest.instanceCount + ' coupes DICOM',
          '      </div>',
          '    </div>',
          '    <a href="' + ohifViewerUrl + '" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:#005d5d; color:#fff; padding:6px 14px; border-radius:4px; font-size:12px; font-weight:600; text-decoration:none;">',
          '      <span>👁️ Consulter dans OHIF ↗</span>',
          '    </a>',
          '  </div>',
          '</div>'
        ].join('');
      },
      unmount: async function (props) {
        if (props.domElement) props.domElement.innerHTML = '';
      },
      update: async function () {}
    };
  }

  // Register on window for Module Federation & SystemJS loader
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
        };
      });
    }
  };

})();
