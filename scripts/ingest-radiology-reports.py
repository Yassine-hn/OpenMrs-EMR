#!/usr/bin/env python3
"""
Ingests clinical radiology reports from DATA PNR CHU BLIDA into OpenMRS:
1. Parses .docx files from Rapports Radio Lakhal.
2. Converts them into clean, standardized medical PDFs with CHU / Imagerie letterhead.
3. Uploads the PDFs to OpenMRS patient attachments via REST API.
"""

import os
import sys
import json
import zipfile
import subprocess
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

BASE_URL = "http://localhost/openmrs/ws/rest/v1"
AUTH_USER = "test-medecin"
AUTH_PASS = "Test-Neuro-2026"
AUTH_HEADER = "Basic " + __import__("base64").b64encode(f"{AUTH_USER}:{AUTH_PASS}".encode("utf-8")).decode("utf-8")

REPORT_MAPPING = [
    {
        "docx": "../DATA PNR CHU BLIDA/Rapports Radio Lakhal/TAMERADEMEXAM-1116259.docx",
        "patient_dossier": "100001W",
        "patient_uuid": "761f62d2-7903-4d71-9d2d-c2642263db13",
        "caption": "Compte-rendu IRM Cérébrale (23/02/2021) - Dr. Lakhal",
        "pdf_name": "CR-IRM-20210223-TAMER-ADEM.pdf"
    },
    {
        "docx": "../DATA PNR CHU BLIDA/Rapports Radio Lakhal/BOUSSEDRAYAMERIEMEXAM-1449903.docx",
        "patient_dossier": "100002U",
        "patient_uuid": "7a9be64b-5885-451c-848f-96f3c1131010",
        "caption": "Compte-rendu IRM Cérébro-médullaire (10/06/2024) - Dr. Lakhal",
        "pdf_name": "CR-IRM-20240610-BOUSSEDRAYA-MERIEM.pdf"
    },
    {
        "docx": "../DATA PNR CHU BLIDA/Rapports Radio Lakhal/LARACHIMOHAMED ANESEXAM-1173001.docx",
        "patient_dossier": "100003R",
        "patient_uuid": "a4238cb1-0579-4546-a893-0fade5d0bb54",
        "caption": "Compte-rendu IRM Post-op Épendymome (25/09/2021) - Dr. Lakhal",
        "pdf_name": "CR-IRM-20210925-LARACHI-MOHAMED-ANES.pdf"
    },
    {
        "docx": "../DATA PNR CHU BLIDA/Rapports Radio Lakhal/LARACHIMOHAMED ANESEXAM-1204327.docx",
        "patient_dossier": "100003R",
        "patient_uuid": "a4238cb1-0579-4546-a893-0fade5d0bb54",
        "caption": "Compte-rendu IRM Réévaluation Épendymome (11/01/2022) - Dr. Lakhal",
        "pdf_name": "CR-IRM-20220111-LARACHI-MOHAMED-ANES.pdf"
    }
]

def parse_docx(path):
    with zipfile.ZipFile(path) as z:
        tree = ET.fromstring(z.read("word/document.xml"))
        paras = []
        for p in tree.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
            texts = [node.text for node in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t") if node.text]
            if texts:
                paras.append("".join(texts).strip())
        return [p for p in paras if p]

def render_html_report(paragraphs, dossier_id, caption):
    paras_html = ""
    in_results = False
    for p in paragraphs:
        p_clean = p.strip()
        if any(h in p_clean.upper() for h in ["RESULTATS :", "RÉSULTATS :", "RESULTATS", "CONCLUSION :", "CONCLUSION"]):
            paras_html += f"<h3 class='section-title'>{p_clean}</h3>"
            in_results = True
        elif any(h in p_clean.upper() for h in ["TECHNIQUE DE L'EXAMEN", "INDICATION", "MOTIF DE LA DEMANDE"]):
            paras_html += f"<h4 class='sub-title'>{p_clean}</h4>"
        elif p_clean.startswith("A l’étage") or p_clean.startswith("À l’étage") or p_clean.startswith("Comparativement"):
            paras_html += f"<p class='paragraph bold-lead'>{p_clean}</p>"
        else:
            paras_html += f"<p class='paragraph'>{p_clean}</p>"

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<style>
  @page {{
    size: A4;
    margin: 15mm 15mm 15mm 15mm;
  }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.45;
    font-size: 11pt;
    margin: 0;
    padding: 0;
  }}
  .header {{
    border-bottom: 2px solid #005d5d;
    padding-bottom: 8px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }}
  .hospital-name {{
    font-size: 13pt;
    font-weight: 700;
    color: #005d5d;
    text-transform: uppercase;
    margin: 0;
  }}
  .sub-header {{
    font-size: 9.5pt;
    color: #525252;
    margin: 2px 0 0 0;
  }}
  .patient-box {{
    background-color: #f4f4f4;
    border-left: 4px solid #005d5d;
    padding: 8px 12px;
    margin-bottom: 14px;
    display: flex;
    justify-content: space-between;
    font-size: 10pt;
  }}
  .patient-box div {{
    flex: 1;
  }}
  .patient-label {{
    color: #6f6f6f;
    font-size: 8.5pt;
    text-transform: uppercase;
    font-weight: 600;
  }}
  .patient-value {{
    font-weight: 700;
    font-size: 10.5pt;
    color: #161616;
  }}
  .section-title {{
    color: #005d5d;
    font-size: 11.5pt;
    font-weight: 700;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 3px;
    margin-top: 14px;
    margin-bottom: 6px;
    text-transform: uppercase;
  }}
  .sub-title {{
    color: #262626;
    font-size: 10.5pt;
    font-weight: 700;
    margin-top: 10px;
    margin-bottom: 4px;
  }}
  .paragraph {{
    margin: 4px 0;
    text-align: justify;
  }}
  .bold-lead {{
    font-weight: 600;
    color: #0f62fe;
    margin-top: 8px;
  }}
  .footer {{
    margin-top: 25px;
    padding-top: 8px;
    border-top: 1px solid #e0e0e0;
    font-size: 8.5pt;
    color: #8d8d8d;
    display: flex;
    justify-content: space-between;
  }}
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="hospital-name">CHU Frantz Fanon — Blida</h1>
      <p class="sub-header">Service de Neurochirurgie & Imagerie Médicale Numérisée</p>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 700; color: #005d5d; font-size: 10pt;">CENTRE D'IMAGERIE MÉDICALE</div>
      <div class="sub-header">Dr. L. M. LAKHAL — Blida</div>
    </div>
  </div>

  <div class="patient-box">
    <div>
      <div class="patient-label">N° de dossier CHU</div>
      <div class="patient-value">{dossier_id}</div>
    </div>
    <div>
      <div class="patient-label">Document</div>
      <div class="patient-value">{caption}</div>
    </div>
  </div>

  <div class="content">
    {paras_html}
  </div>

  <div class="footer">
    <div>Dossier Médical Numérisé — Neurochirurgie CHU Frantz Fanon Blida</div>
    <div>Archivage certifié PACS / O3</div>
  </div>
</body>
</html>
"""
    return html

def convert_html_to_pdf(html_content, output_pdf_path):
    temp_html = output_pdf_path.replace(".pdf", ".html")
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html_content)

    cmd = [
        "google-chrome",
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        f"--print-to-pdf={output_pdf_path}",
        f"file://{os.path.abspath(temp_html)}"
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(temp_html):
        os.remove(temp_html)

def upload_attachment(patient_uuid, pdf_path, caption):
    boundary = "----WebKitFormBoundary" + __import__("secrets").token_hex(16)
    filename = os.path.basename(pdf_path)

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    body = bytearray()

    # Field: patient
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(b'Content-Disposition: form-data; name="patient"\r\n\r\n')
    body.extend(patient_uuid.encode("utf-8") + b"\r\n")

    # Field: fileCaption
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(b'Content-Disposition: form-data; name="fileCaption"\r\n\r\n')
    body.extend(caption.encode("utf-8") + b"\r\n")

    # Field: file
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"))
    body.extend(b"Content-Type: application/pdf\r\n\r\n")
    body.extend(pdf_bytes)
    body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(
        f"{BASE_URL}/attachment",
        data=body,
        headers={
            "Authorization": AUTH_HEADER,
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        },
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res.get("uuid")

def main():
    os.makedirs("backups/reports", exist_ok=True)
    print("Processing and ingesting radiology reports into OpenMRS...")

    for rep in REPORT_MAPPING:
        docx_path = rep["docx"]
        if not os.path.exists(docx_path):
            print(f"Error: {docx_path} not found", file=sys.stderr)
            continue

        print(f"\nProcessing {os.path.basename(docx_path)} for patient {rep['patient_dossier']}...")
        paras = parse_docx(docx_path)
        html = render_html_report(paras, rep["patient_dossier"], rep["caption"])
        pdf_path = os.path.join("backups/reports", rep["pdf_name"])
        convert_html_to_pdf(html, pdf_path)
        size_kb = os.path.getsize(pdf_path) / 1024
        print(f"  Generated PDF: {pdf_path} ({size_kb:.1f} KB)")

        att_uuid = upload_attachment(rep["patient_uuid"], pdf_path, rep["caption"])
        print(f"  SUCCESS: Uploaded to OpenMRS attachment UUID {att_uuid}")

    print("\n--- All radiology reports ingested successfully ---")

if __name__ == "__main__":
    main()
