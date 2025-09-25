# python-service/detectors.py
import pytesseract
from pytesseract import Output
from pdf2image import convert_from_bytes
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps
import re, io, os
from typing import Tuple, List, Dict

# --- IMPORTANT: HARDCODED PATHS FOR EXTERNAL DEPENDENCIES ---
# This section prevents errors if Tesseract or Poppler are not in the system's PATH.
# Make sure these paths are correct for your machine.

# 1. Path to the Tesseract executable
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# 2. Path to the Poppler 'bin' directory
POPPLER_PATH = r"C:\Users\dell\Downloads\Release-25.07.0-0\poppler-25.07.0\Library\bin"


# --- NER MODEL SETUP ---
# Attempt to load a more advanced NER model; fall back to a standard one if it fails.
USE_INDIC = False
try:
    from transformers import AutoTokenizer, AutoModelForTokenClassification, pipeline
    tokenizer = AutoTokenizer.from_pretrained("ai4bharat/IndicNER")
    model = AutoModelForTokenClassification.from_pretrained("ai4bharat/IndicNER")
    indic_ner = pipeline("ner", model=model, tokenizer=tokenizer, aggregation_strategy="simple")
    USE_INDIC = True
    print("✅ IndicNER model loaded successfully.")
except Exception:
    USE_INDIC = False
    print("⚠️ IndicNER model not found. Falling back to spaCy.")

import spacy
nlp = spacy.load("en_core_web_sm")


# --- REGEX PATTERNS ---
PII_PATTERNS = {
    "PAN": re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"),
    "AADHAAR": re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"),
    "PHONE": re.compile(r"\b[6-9]\d{9}\b"),
    "EMAIL": re.compile(r"\b[\w\.-]+@[\w\.-]+\.\w{2,3}\b")
}


# --- IMAGE PROCESSING FUNCTIONS ---

def preprocess_pil(img: Image.Image) -> Image.Image:
    """Applies lightweight preprocessing for better OCR results."""
    img = img.convert("L")
    img = ImageOps.autocontrast(img)
    img = ImageEnhance.Sharpness(img).enhance(1.5)
    return img

def image_pages_from_bytes(file_bytes: bytes, filename: str) -> List[Image.Image]:
    """Converts file bytes into a list of PIL images, handling both PDFs and standard images."""
    ext = filename.lower()
    if ext.endswith(".pdf"):
        pages = convert_from_bytes(file_bytes, poppler_path=POPPLER_PATH)
        return pages
    else:
        img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        return [img]

def _build_lines_from_ocr(data: dict):
    """Helper function to group Tesseract's word-level output into coherent lines."""
    lines = {}
    for i in range(len(data["text"])):
        word = data["text"][i].strip()
        if not word:
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        if key not in lines:
            lines[key] = {"words": [], "indices": []}
        lines[key]["words"].append(word)
        lines[key]["indices"].append(i)
    
    for k, v in lines.items():
        v["line_text"] = " ".join(v["words"])
        offsets = []
        pos = 0
        for w in v["words"]:
            offsets.append((pos, pos + len(w)))
            pos += len(w) + 1
        v["offsets"] = offsets
    return lines


# --- CORE DETECTION AND REDACTION LOGIC ---

def detect_pii_on_image(pil_img: Image.Image, page_index: int = 0) -> Tuple[List[Dict], Dict]:
    """Runs OCR on a single image and detects PII using regex and NER models."""
    img_w, img_h = pil_img.size
    pil_proc = preprocess_pil(pil_img)
    data = pytesseract.image_to_data(pil_proc, output_type=Output.DICT, config="--psm 6")
    
    boxes = []
    summary = {}

    # Regex-based Detection
    for i, word in enumerate(data["text"]):
        w = (word or "").strip()
        if not w:
            continue
        for label, pattern in PII_PATTERNS.items():
            if pattern.fullmatch(w):
                l, t, width, height = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
                boxes.append({"label": label, "text": w, "left": l, "top": t, "width": width, "height": height, "page": page_index})
                summary[label] = summary.get(label, 0) + 1

    # NER-based Detection
    lines = _build_lines_from_ocr(data)
    for key, obj in lines.items():
        line_text = obj["line_text"].strip()
        if not line_text:
            continue
        
        ents = []
        if USE_INDIC:
            ents = indic_ner(line_text)
        else:
            doc = nlp(line_text)
            ents = [{"entity_group": ent.label_, "word": ent.text, "start": ent.start_char, "end": ent.end_char} for ent in doc.ents]

        for ent in ents:
            ent_group = (ent.get("entity_group") or ent.get("label", "")).upper()
            if ent_group not in ("PER", "PERSON"):
                continue
            
            ent_word = ent.get("word") or ent.get("entity")
            word_indices = []
            for k, (s, e) in enumerate(obj["offsets"]):
                if not (e <= ent["start"] or s >= ent["end"]):
                    word_indices.append(obj["indices"][k])

            if not word_indices:
                continue

            x0 = min(data["left"][i] for i in word_indices)
            y0 = min(data["top"][i] for i in word_indices)
            x1 = max(data["left"][i] + data["width"][i] for i in word_indices)
            y1 = max(data["top"][i] + data["height"][i] for i in word_indices)
            
            boxes.append({"label": "NAME", "text": ent_word, "left": x0, "top": y0, "width": x1-x0, "height": y1-y0, "page": page_index})
            summary["NAME"] = summary.get("NAME", 0) + 1

    return boxes, summary

def detect_pii_from_bytes(file_bytes: bytes, filename: str):
    """Processes file bytes, runs detection on each page, and returns combined results."""
    images = image_pages_from_bytes(file_bytes, filename)
    all_boxes = []
    combined_summary = {}
    for idx, img in enumerate(images):
        boxes, summary = detect_pii_on_image(img, page_index=idx)
        all_boxes.extend(boxes)
        for k, v in summary.items():
            combined_summary[k] = combined_summary.get(k, 0) + v
    
    entities = [{
        "label": b["label"],
        "text": b.get("text", ""),
        "page": b.get("page", 0),
        "box": {"left": int(b["left"]), "top": int(b["top"]), "width": int(b["width"]), "height": int(b["height"])}
    } for b in all_boxes]
    
    return entities, combined_summary

def redact_bytes(file_bytes: bytes, filename: str, labels: List[str], mode: str = "black", partial: bool = False) -> Tuple[bytes, str]:
    """Redacts specified PII labels from a document and returns the redacted file bytes."""
    labels_set = set([l.upper() for l in labels])
    images = image_pages_from_bytes(file_bytes, filename)
    redacted_pages = []
    
    for idx, img in enumerate(images):
        boxes, _ = detect_pii_on_image(img, page_index=idx)
        boxes_to_apply = [b for b in boxes if b["label"].upper() in labels_set]
        
        pil = img.convert("RGB")
        draw = ImageDraw.Draw(pil)
        
        for b in boxes_to_apply:
            l, t, r, bt = int(b["left"]), int(b["top"]), int(b["left"] + b["width"]), int(b["top"] + b["height"])
            if partial:
                mask_ratio = 1.0
                if b["label"] in ("AADHAAR", "PHONE"): mask_ratio = 0.7
                elif b["label"] in ("PAN", "EMAIL"): mask_ratio = 0.6
                
                mask_w = int((r - l) * mask_ratio)
                if mode == "black":
                    draw.rectangle([l, t, l + mask_w, bt], fill="black")
                else:
                    region = pil.crop((l, t, l + mask_w, bt)).filter(ImageFilter.GaussianBlur(10))
                    pil.paste(region, (l, t))
            else:
                if mode == "black":
                    draw.rectangle([l, t, r, bt], fill="black")
                else:
                    region = pil.crop((l, t, r, bt)).filter(ImageFilter.GaussianBlur(10))
                    pil.paste(region, (l, t))
        redacted_pages.append(pil)

    if len(redacted_pages) == 1 and not filename.lower().endswith(".pdf"):
        buf = io.BytesIO()
        redacted_pages[0].save(buf, format="PNG")
        out_name = f"redacted_{os.path.splitext(filename)[0]}.png"
        return buf.getvalue(), out_name
    else:
        out_buf = io.BytesIO()
        redacted_pages[0].save(out_buf, format="PDF", save_all=True, append_images=redacted_pages[1:])
        out_name = f"redacted_{os.path.splitext(filename)[0]}.pdf"
        return out_buf.getvalue(), out_name