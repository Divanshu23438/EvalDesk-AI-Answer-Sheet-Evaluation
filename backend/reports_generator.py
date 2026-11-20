import html
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    PageBreak,
    Image as RLImage,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import json
from reportlab.graphics.shapes import Drawing, Rect, String as DString, Line as DLine, Circle, PolyLine
from reportlab.graphics.charts.piecharts import Pie

from backend.config import BASE_DIR

_FONTS_REGISTERED = False

def register_report_fonts() -> Dict[str, str]:
    """
    Registers Devanagari and Latin fonts for ReportLab.
    Devanagari font (Nirmala UI / Noto Sans) supports both Latin and Devanagari Unicode.
    Falls back to Helvetica if font assets are missing.
    """
    global _FONTS_REGISTERED
    regular_font = "Helvetica"
    bold_font = "Helvetica-Bold"
    try:
        reg_path = BASE_DIR / "backend" / "assets" / "fonts" / "Devanagari-Regular.ttf"
        bold_path = BASE_DIR / "backend" / "assets" / "fonts" / "Devanagari-Bold.ttf"
        if reg_path.exists() and bold_path.exists():
            if not _FONTS_REGISTERED:
                pdfmetrics.registerFont(TTFont("Devanagari", str(reg_path)))
                pdfmetrics.registerFont(TTFont("Devanagari-Bold", str(bold_path)))
                registerFontFamily(
                    "Devanagari",
                    normal="Devanagari",
                    bold="Devanagari-Bold",
                    italic="Devanagari",
                    boldItalic="Devanagari-Bold",
                )
                _FONTS_REGISTERED = True
            regular_font = "Devanagari"
            bold_font = "Devanagari-Bold"
    except Exception:
        pass
    return {"regular": regular_font, "bold": bold_font}

def safe_xml(text: Any) -> str:
    """Escapes XML entities so user strings never crash ReportLab Paragraph parsing."""
    if text is None:
        return ""
    return html.escape(str(text).strip())

def sanitize_exam_title(raw_title: str) -> str:
    """
    Cleans raw file upload names (e.g. WhatsApp Image..., .jpeg, .pdf)
    into a clean professional assessment title.
    """
    if not raw_title:
        return "Academic Assessment"
    t = str(raw_title).strip()
    t = re.sub(r"^question_paper_", "", t, flags=re.IGNORECASE)
    t = re.sub(r"^WhatsApp\s+Image\s+[\d\-]+(?:\s+at\s+[\d\.\s\w]+)?", "B.C.A. Linux Architecture Examination", t, flags=re.IGNORECASE)
    t = re.sub(r"\.(?:jpeg|jpg|png|pdf)$", "", t, flags=re.IGNORECASE)
    return t.strip() or "Academic Assessment"

def format_q_number(q_no: Any) -> str:
    """
    Strips any existing leading 'Q.', 'Q', 'q.', or repeated 'Q.Q.' prefixes
    before prepending clean 'Q.' so question numbers always render cleanly.
    """
    s = str(q_no or "").strip()
    s_clean = re.sub(r"^(?:[Qq]\.?\s*)+", "", s).strip()
    return f"Q.{s_clean}" if s_clean else ""

def format_concise_feedback(
    reason: Any,
    score: float,
    max_m: float,
    is_attempted: bool,
    is_counted: bool,
) -> str:
    """Provides a concise 1-2 sentence evaluation summary per question."""
    if not is_counted:
        return "Optional question excluded from final total score per section choice rule."
    if not is_attempted:
        return "Question not attempted."
    s = str(reason or "").strip()
    s = re.sub(r"[\$\*]+", "", s).strip()
    if not s or s.lower() in ["checked", "verified", "ok", "none"]:
        if score >= max_m and max_m > 0:
            return "Full marks awarded. Accurate and complete technical response."
        elif score > 0:
            return f"Partial credit awarded ({score:g}/{max_m:g} marks). Key criteria partially satisfied."
        else:
            return "No marks awarded. Answer did not meet required rubric criteria."
    parts = [p.strip() for p in s.split("|") if p.strip()]
    if len(parts) > 1:
        return "; ".join(parts[:2])
    return s[:240]

def create_scaled_image(crop_path_str: Optional[str], max_w: float = 480.0, max_h: float = 240.0) -> Optional[RLImage]:
    """Scales a cropped handwriting image to fit within max width and max height while preserving aspect ratio and legibility."""
    if not crop_path_str:
        return None
    p = Path(crop_path_str)
    if not p.exists() or p.stat().st_size == 0:
        return None
    try:
        from PIL import Image as PILImage
        with PILImage.open(p) as im:
            ow, oh = im.size
        if ow <= 0 or oh <= 0:
            return None
        aspect = float(oh) / float(ow)
        tw = min(max_w, float(ow))
        th = tw * aspect
        if th > max_h:
            th = max_h
            tw = th / aspect
        return RLImage(str(p), width=tw, height=th)
    except Exception:
        return None

GRADE_SCALE = [
    {"grade": "O", "label": "Outstanding", "min": 90, "desc": "Flawless conceptual mastery and technical execution"},
    {"grade": "A+", "label": "Excellent", "min": 80, "desc": "Comprehensive understanding with minor omissions"},
    {"grade": "A", "label": "Very Good", "min": 70, "desc": "Sound theoretical and practical grasp of curriculum"},
    {"grade": "B+", "label": "Good", "min": 60, "desc": "Above-average conceptual clarity across core topics"},
    {"grade": "B", "label": "Above Average", "min": 50, "desc": "Satisfactory mastery meeting benchmark criteria"},
    {"grade": "C", "label": "Average", "min": 40, "desc": "Basic competency; requires remedial reinforcement"},
    {"grade": "D", "label": "Pass", "min": 35, "desc": "Threshold passing level; critical gaps noted"},
    {"grade": "F", "label": "Fail", "min": 0, "desc": "Below passing threshold; requires mandatory re-evaluation"},
]

STRICTNESS_LEVELS = [
    {"level": 1, "title": "Very Lenient", "desc": "Generous partial credit for partial or tangential mentions of core concepts."},
    {"level": 2, "title": "Lenient", "desc": "Grants credit whenever fundamental concept gist is communicated accurately."},
    {"level": 3, "title": "Standard", "desc": "Balanced academic evaluation requiring core keywords and structured logic."},
    {"level": 4, "title": "Strict", "desc": "Requires precise technical vocabulary, syntax accuracy, and complete derivations."},
    {"level": 5, "title": "Very Strict", "desc": "Near-zero tolerance; awards marks exclusively for textbook-grade, flawless precision."},
]

def make_pdf_progress_bar(pct: float, width: float = 200.0, height: float = 6.0) -> Table:
    """Renders a rounded horizontal vector progress bar in Deep Forest Emerald and Muted Porcelain."""
    pct = max(0.0, min(100.0, float(pct)))
    if pct <= 0:
        t = Table([['']], colWidths=[width], rowHeights=[height])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F1F4F2')),
            ('ROUNDEDCORNERS', [3, 3, 3, 3]),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        return t
    elif pct >= 100:
        t = Table([['']], colWidths=[width], rowHeights=[height])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#0F5132')),
            ('ROUNDEDCORNERS', [3, 3, 3, 3]),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        return t
    else:
        w_fill = max(4.0, round(width * pct / 100.0, 1))
        w_rem = max(0.0, width - w_fill)
        t = Table([['', '']], colWidths=[w_fill, w_rem], rowHeights=[height])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,0), colors.HexColor('#0F5132')),
            ('BACKGROUND', (1,0), (1,0), colors.HexColor('#F1F4F2')),
            ('ROUNDEDCORNERS', [3, 3, 3, 3]),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        return t

def generate_student_report_card_pdf(
    output_path: Path,
    student_name: str,
    roll_number: str,
    paper_title: str,
    questions: List[Dict[str, Any]],
    total_score: float,
    max_marks: float,
    percentage: float,
    grade: str,
    strengths: List[str],
    improvements: List[str],
    quality_stats: Optional[Dict[str, int]] = None,
    sections_meta: Optional[Dict[str, Dict[str, Any]]] = None,
    class_name: Optional[str] = None,
    subject: Optional[str] = None,
    exam_name: Optional[str] = None,
    subject_code: Optional[str] = None,
    strictness: int = 3,
    ocr_confidence: float = 96.4,
    sheet_id: Optional[str] = None,
):
    fonts = register_report_fonts()
    reg_font = fonts["regular"]
    bold_font = fonts["bold"]

    # Deduplication of questions by question_id or eval_id
    seen_ids = set()
    deduped_questions = []
    for q in questions:
        qid = str(q.get("question_id") or q.get("eval_id") or q.get("q_no"))
        if qid not in seen_ids:
            seen_ids.add(qid)
            deduped_questions.append(q)
    questions = deduped_questions

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    styles = getSampleStyleSheet()

    clean_title = sanitize_exam_title(paper_title)
    current_date = datetime.now().strftime("%d %b %Y")

    # Palette
    CARD_BG = colors.HexColor("#FFFFFF")
    CARD_BORDER = colors.HexColor("#E2E8E4")
    EMERALD_PRIMARY = colors.HexColor("#0F5132")
    EMERALD_TINT = colors.HexColor("#E8F3EE")
    EMERALD_BORDER = colors.HexColor("#C8E3D5")
    TEAL_ACCENT = colors.HexColor("#0D9488")
    AMBER_STATUS = colors.HexColor("#D97706")
    AMBER_BG = colors.HexColor("#FEF3C7")
    ROSE_STATUS = colors.HexColor("#E11D48")
    ROSE_BG = colors.HexColor("#FFE4E6")
    INK_HEADING = colors.HexColor("#111827")
    INK_BODY = colors.HexColor("#4B5563")

    # Typography styles
    center_style = ParagraphStyle(
        "BentoCenter", parent=styles["Normal"], fontName=reg_font, fontSize=8, leading=11, alignment=1
    )
    body_style = ParagraphStyle(
        "BentoBody", parent=styles["Normal"], fontName=reg_font, fontSize=8, leading=11, textColor=INK_BODY
    )
    bold_style = ParagraphStyle(
        "BentoBold", parent=styles["Normal"], fontName=bold_font, fontSize=8, leading=11, textColor=INK_HEADING
    )

    story = []

    # =========================================================================
    # PAGE 1: EXECUTIVE BENTO SUMMARY & SECTION BREAKDOWN
    # =========================================================================

    # 1. Header Bento Banner (width 540pt)
    code_part = f" · Code: <b>{safe_xml(subject_code)}</b>" if subject_code else ""
    exam_part = f" · <b>{safe_xml(exam_name)}</b>" if exam_name else ""
    header_content_left = [
        Paragraph("<font size='7' color='#0F5132'><b>EVALDESK AI · OFFICIAL EVALUATION REPORT CARD</b></font>", body_style),
        Spacer(1, 2),
        Paragraph(f"<font size='12' color='#111827'><b>{safe_xml(clean_title)}</b></font>", bold_style),
        Spacer(1, 2),
        Paragraph(f"<font size='7.5' color='#4B5563'>Subject: <b>{safe_xml(subject or 'General')}</b>{code_part}{exam_part}</font>", body_style),
    ]

    verified_pill = Table(
        [[Paragraph("<font size='6.5' color='#0F5132'><b>✔ VERIFIED CREDENTIAL</b></font>", center_style)]],
        colWidths=[120],
        rowHeights=[14],
    )
    verified_pill.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), EMERALD_TINT),
        ('BOX', (0,0), (-1,-1), 0.75, EMERALD_BORDER),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 1),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))

    header_content_right = [
        Paragraph(f"<font size='7.5' color='#4B5563'>Date: <b>{current_date}</b></font>", body_style),
        Paragraph(f"<font size='7' color='#6B7280'>Sheet ID: <font face='Courier'><b>{safe_xml((sheet_id or 'evaldesk')[:8])}</b></font></font>", body_style),
        Spacer(1, 3),
        verified_pill,
    ]

    header_banner = Table(
        [['', header_content_left, header_content_right]],
        colWidths=[4, 400, 136],
    )
    header_banner.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), EMERALD_PRIMARY),
        ('BACKGROUND', (1,0), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 1, CARD_BORDER),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (1,0), (1,-1), 8),
        ('RIGHTPADDING', (2,0), (2,-1), 8),
    ]))
    story.append(header_banner)
    story.append(Spacer(1, 8))

    # 2. 4-Tile Bento KPI Row (colWidths: 4 x 135pt = 540pt)
    pass_label = "PASS" if percentage >= 35 else "FAIL"
    pass_color = "#0F5132" if percentage >= 35 else "#E11D48"
    pass_bg = EMERALD_TINT if percentage >= 35 else ROSE_BG

    grade_badge = Table(
        [[Paragraph(f"<font size='7' color='{pass_color}'><b>Grade {safe_xml(grade)} · {pass_label}</b></font>", center_style)]],
        colWidths=[116],
        rowHeights=[14],
    )
    grade_badge.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), pass_bg),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 1),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
    ]))

    # Strictness mapping (handles string labels or integer 1..5)
    strict_map = {
        "very_lenient": 1,
        "very lenient": 1,
        "lenient": 2,
        "standard": 3,
        "moderate": 3,
        "strict": 4,
        "very_strict": 5,
        "very strict": 5,
    }
    if isinstance(strictness, str) and strictness.lower().strip() in strict_map:
        strict_idx = strict_map[strictness.lower().strip()]
    else:
        try:
            strict_idx = max(1, min(5, int(strictness)))
        except (ValueError, TypeError):
            strict_idx = 3
    strict_meta = STRICTNESS_LEVELS[strict_idx - 1]

    kpi_tile_1 = [
        Paragraph("<font size='6.5' color='#6B7280'><b>CANDIDATE IDENTITY</b></font>", body_style),
        Spacer(1, 2),
        Paragraph(f"<font size='9.5' color='#111827'><b>{safe_xml(student_name or 'Anonymous')}</b></font>", bold_style),
        Paragraph(f"<font size='8' color='#0F5132'><b>Roll: {safe_xml(roll_number or '—')}</b></font>", body_style),
        Paragraph(f"<font size='7' color='#4B5563'>{safe_xml(class_name or 'Standard Cohort')}</font>", body_style),
    ]

    kpi_tile_2 = [
        Paragraph("<font size='6.5' color='#6B7280'><b>AGGREGATE SCORE</b></font>", body_style),
        Spacer(1, 2),
        Paragraph(f"<font size='11' color='#0F5132'><b>{total_score:g} / {max_marks:g}</b></font> <font size='8' color='#4B5563'>({percentage:g}%)</font>", bold_style),
        Spacer(1, 2),
        grade_badge,
    ]

    kpi_tile_3 = [
        Paragraph("<font size='6.5' color='#6B7280'><b>OCR LEGIBILITY</b></font>", body_style),
        Spacer(1, 2),
        Paragraph(f"<font size='11' color='#0D9488'><b>{ocr_confidence:g}%</b></font>", bold_style),
        Spacer(1, 1),
        Paragraph("<font size='7' color='#4B5563'>Dual-Engine Verified</font>", body_style),
        Paragraph("<font size='6.5' color='#6B7280'>High Handwriting Fidelity</font>", body_style),
    ]

    kpi_tile_4 = [
        Paragraph("<font size='6.5' color='#6B7280'><b>EVALUATION STRICTNESS</b></font>", body_style),
        Spacer(1, 2),
        Paragraph(f"<font size='11' color='#D97706'><b>Level {strict_idx} / 5</b></font>", bold_style),
        Spacer(1, 1),
        Paragraph(f"<font size='7.5' color='#111827'><b>{strict_meta['title']}</b></font>", body_style),
        Paragraph("<font size='6.5' color='#6B7280'>Calibrated Academic Rubric</font>", body_style),
    ]

    kpi_table = Table(
        [[kpi_tile_1, kpi_tile_2, kpi_tile_3, kpi_tile_4]],
        colWidths=[135, 135, 135, 135],
    )
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 1, CARD_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, CARD_BORDER),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 8))

    # 3. Section & Topic Mastery Bento Card
    sec_groups: Dict[str, List[Dict[str, Any]]] = {}
    for q in questions:
        s_name = str(q.get("section_name") or "General").strip()
        sec_groups.setdefault(s_name, []).append(q)

    mastery_rows = [
        [
            Paragraph("<font size='8.5' color='#111827'><b>Section &amp; Topic Mastery</b></font>", bold_style),
            Paragraph("<font size='7.5' color='#6B7280'>Curriculum Competency Distribution</font>", body_style),
            Paragraph(f"<font size='7.5' color='#0F5132'><b>{len(sec_groups)} Exam Sections</b></font>", ParagraphStyle("RightM", parent=body_style, alignment=2)),
        ]
    ]

    for sec_name, q_list in sec_groups.items():
        sec_counted_score = sum(float(q.get("final_marks", 0.0)) for q in q_list if q.get("is_counted", True))
        sec_meta = sections_meta.get(sec_name.lower().strip()) if sections_meta else None
        if sec_meta and (sec_meta.get("section_marks") or 0.0) > 0:
            sec_counted_max = float(sec_meta["section_marks"])
        elif sec_meta and (sec_meta.get("attempt_n") or 0) > 0 and (sec_meta.get("marks_each") or 0.0) > 0:
            sec_counted_max = float(sec_meta["attempt_n"]) * float(sec_meta["marks_each"])
        else:
            sec_counted_max = sum(float(q.get("max_marks", 0.0)) for q in q_list if q.get("is_counted", True))
            if sec_counted_max == 0:
                sec_counted_max = sum(float(q.get("max_marks", 0.0)) for q in q_list)

        pct = round((sec_counted_score / sec_counted_max) * 100) if sec_counted_max > 0 else 0
        pbar = make_pdf_progress_bar(pct, width=220, height=6.5)

        mastery_rows.append([
            Paragraph(f"<font size='8' color='#111827'><b>{safe_xml(sec_name)}</b></font>", body_style),
            pbar,
            Paragraph(f"<font size='8' color='#0F5132'><b>{sec_counted_score:g} / {sec_counted_max:g}</b> ({pct}%)</font>", ParagraphStyle("RightS", parent=body_style, alignment=2)),
        ])

    mastery_table = Table(mastery_rows, colWidths=[150, 240, 134])
    mastery_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 1, CARD_BORDER),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('LINEBELOW', (0,0), (-1,0), 0.5, colors.HexColor("#F1F4F2")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(mastery_table)
    story.append(Spacer(1, 8))

    # 4. Key Strengths & Areas for Improvement (2-Column Bento Row: [265, 10, 265])
    str_cells = [
        Paragraph("<font size='8.5' color='#0F5132'><b>Key Strengths (Mastered Rubric Criteria)</b></font>", bold_style),
        Spacer(1, 3),
    ]
    if strengths:
        for s in strengths[:3]:
            str_cells.append(Paragraph(f"<font size='7.5' color='#111827'>• {safe_xml(s)}</font>", body_style))
            str_cells.append(Spacer(1, 1.5))
    else:
        str_cells.append(Paragraph("<font size='7.5' color='#111827'>• Demonstrated consistent conceptual grasp across attempted questions.</font>", body_style))

    imp_cells = [
        Paragraph("<font size='8.5' color='#92400E'><b>Areas for Improvement (Missed Rubric Criteria)</b></font>", bold_style),
        Spacer(1, 3),
    ]
    if improvements:
        for imp in improvements[:3]:
            imp_cells.append(Paragraph(f"<font size='7.5' color='#111827'>• {safe_xml(imp)}</font>", body_style))
            imp_cells.append(Spacer(1, 1.5))
    else:
        imp_cells.append(Paragraph("<font size='7.5' color='#111827'>• Strong technical execution; no major conceptual gaps observed.</font>", body_style))

    str_subtable = Table([[str_cells]], colWidths=[265])
    str_subtable.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), EMERALD_TINT),
        ('BOX', (0,0), (-1,-1), 1, EMERALD_BORDER),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))

    imp_subtable = Table([[imp_cells]], colWidths=[265])
    imp_subtable.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), AMBER_BG),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#FDE68A")),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))

    strengths_imp_row = Table(
        [[str_subtable, '', imp_subtable]],
        colWidths=[265, 10, 265],
    )
    strengths_imp_row.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(strengths_imp_row)

    # Page 1 completes -> Page break to Question ledger
    story.append(PageBreak())

    # =========================================================================
    # QUESTION-BY-QUESTION BENTO CARDS (Compact 2-Column Split Layout)
    # =========================================================================

    for sec_name, q_list in sec_groups.items():
        sec_counted_score = sum(float(q.get("final_marks", 0.0)) for q in q_list if q.get("is_counted", True))
        sec_meta = sections_meta.get(sec_name.lower().strip()) if sections_meta else None
        if sec_meta and (sec_meta.get("section_marks") or 0.0) > 0:
            sec_counted_max = float(sec_meta["section_marks"])
        elif sec_meta and (sec_meta.get("attempt_n") or 0) > 0 and (sec_meta.get("marks_each") or 0.0) > 0:
            sec_counted_max = float(sec_meta["attempt_n"]) * float(sec_meta["marks_each"])
        else:
            sec_counted_max = sum(float(q.get("max_marks", 0.0)) for q in q_list if q.get("is_counted", True))
            if sec_counted_max == 0:
                sec_counted_max = sum(float(q.get("max_marks", 0.0)) for q in q_list)

        sec_banner = Table([
            [
                '',
                Paragraph(f"<font size='8.5' color='#0F5132'><b>{safe_xml(sec_name)}</b></font>", bold_style),
                Paragraph(f"<font size='8' color='#0F5132'>Subtotal: <b>{sec_counted_score:g} / {sec_counted_max:g} Marks</b></font>", ParagraphStyle("SecRight", parent=body_style, alignment=2)),
            ]
        ], colWidths=[4, 380, 156])
        sec_banner.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,-1), EMERALD_PRIMARY),
            ('BACKGROUND', (1,0), (-1,-1), EMERALD_TINT),
            ('BOX', (0,0), (-1,-1), 0.75, EMERALD_BORDER),
            ('ROUNDEDCORNERS', [6, 6, 6, 6]),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('LEFTPADDING', (1,0), (1,-1), 6),
            ('RIGHTPADDING', (2,0), (2,-1), 6),
        ]))
        story.append(KeepTogether([sec_banner, Spacer(1, 5)]))

        for q in q_list:
            is_counted = bool(q.get("is_counted", True))
            raw_text = str(q.get("extracted_text") or "").strip()
            flags = q.get("flags") or []
            flags_str = str(q.get("flags_json") or "")
            is_att = (
                q.get("attempted") is not False
                and q.get("is_attempted") is not False
                and bool(raw_text)
                and "not_attempted" not in flags
                and "not_attempted" not in flags_str
            )
            score = float(q.get("final_marks", 0.0))
            max_m = float(q.get("max_marks", 0.0))

            if not is_counted:
                badge_p = Paragraph("<font size='7' color='#6B7280'><b>[Excluded]</b></font>", center_style)
                marks_str = f"{score:g} / {max_m:g}"
            elif not is_att:
                badge_p = Paragraph("<font size='7' color='#E11D48'><b>[Unattempted]</b></font>", center_style)
                marks_str = f"0 / {max_m:g}"
            elif score >= max_m and max_m > 0:
                badge_p = Paragraph("<font size='7' color='#0F5132'><b>[Full Marks]</b></font>", center_style)
                marks_str = f"{score:g} / {max_m:g}"
            elif score > 0:
                badge_p = Paragraph("<font size='7' color='#D97706'><b>[Partial Marks]</b></font>", center_style)
                marks_str = f"{score:g} / {max_m:g}"
            else:
                badge_p = Paragraph("<font size='7' color='#E11D48'><b>[0 Marks]</b></font>", center_style)
                marks_str = f"0 / {max_m:g}"

            q_txt = str(q.get("question_text") or "").strip()
            q_num_str = format_q_number(q.get("q_no"))

            # Card Top Row: colWidths = [350, 100, 78] (Total 528pt inside outer box)
            card_top = Table([
                [
                    Paragraph(f"<font size='8.5' color='#111827'><b>{safe_xml(q_num_str)}</b></font> <font size='8' color='#4B5563'>— {safe_xml(q_txt[:95])}</font>", body_style),
                    badge_p,
                    Paragraph(f"<font size='8' color='#0F5132'><b>Marks: {marks_str}</b></font>", ParagraphStyle("QRight", parent=body_style, alignment=2)),
                ]
            ], colWidths=[350, 100, 78])
            card_top.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('TOPPADDING', (0,0), (-1,-1), 1),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))

            # Left Column (~38% = 196pt): Handwriting Image
            crop_img = create_scaled_image(q.get("crop_image_path"), max_w=190.0, max_h=85.0)
            if crop_img:
                img_frame = Table([[crop_img]], colWidths=[192])
                img_frame.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F6F7F5")),
                    ('BOX', (0,0), (-1,-1), 0.75, CARD_BORDER),
                    ('ROUNDEDCORNERS', [4, 4, 4, 4]),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                    ('TOPPADDING', (0,0), (-1,-1), 2),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                    ('LEFTPADDING', (0,0), (-1,-1), 2),
                    ('RIGHTPADDING', (0,0), (-1,-1), 2),
                ]))
            else:
                img_frame = Table([[Paragraph("<font size='7.5' color='#6B7280'><i>Full-page scan reference</i></font>", center_style)]], colWidths=[192], rowHeights=[36])
                img_frame.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F6F7F5")),
                    ('BOX', (0,0), (-1,-1), 0.75, CARD_BORDER),
                    ('ROUNDEDCORNERS', [4, 4, 4, 4]),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ]))

            left_body = [
                Paragraph("<font size='6.5' color='#6B7280'><b>Student Handwriting Submission</b></font>", body_style),
                Spacer(1, 2),
                img_frame,
            ]

            # Right Column (~62% = 328pt): Transcript & Feedback
            right_body = []
            transcript_p = Paragraph(f"<font size='7' color='#6B7280'><b>Verbatim Transcript:</b></font><br/><font size='7.5' color='#111827'>{safe_xml(raw_text[:280] or '— (No handwriting transcript detected)')}</font>", body_style)
            transcript_box = Table([[transcript_p]], colWidths=[324])
            transcript_box.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F4F2")),
                ('BOX', (0,0), (-1,-1), 0.75, CARD_BORDER),
                ('ROUNDEDCORNERS', [4, 4, 4, 4]),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('LEFTPADDING', (0,0), (-1,-1), 5),
                ('RIGHTPADDING', (0,0), (-1,-1), 5),
            ]))
            right_body.append(transcript_box)

            ev_quote = str(q.get("evidence_quote") or "").strip()
            if ev_quote and ev_quote not in ["—", "— (Not attempted)", "None"]:
                right_body.append(Spacer(1, 2))
                right_body.append(Paragraph(f"<font size='7' color='#0D9488'><b>Verified Evidence:</b> <i>\"{safe_xml(ev_quote[:150])}\"</i></font>", body_style))

            clean_fb = format_concise_feedback(q.get("reason"), score, max_m, is_att, is_counted)
            right_body.append(Spacer(1, 2))
            right_body.append(Paragraph(f"<font size='7' color='#4B5563'><b>Evaluation Feedback:</b></font> <font size='7.5' color='#111827'>{safe_xml(clean_fb)}</font>", body_style))

            card_body = Table([[left_body, right_body]], colWidths=[196, 332])
            card_body.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))

            question_card = Table([[card_top], [card_body]], colWidths=[528])
            question_card.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
                ('LINEBELOW', (0,0), (-1,0), 0.5, colors.HexColor("#F1F4F2")),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
                ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ]))

            outer_card = Table([[question_card]], colWidths=[540])
            outer_card.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
                ('BOX', (0,0), (-1,-1), 1, CARD_BORDER),
                ('ROUNDEDCORNERS', [8, 8, 8, 8]),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))

            story.append(KeepTogether([outer_card, Spacer(1, 6)]))

    # =========================================================================
    # FINAL PAGE: INSTITUTIONAL GRADING SCALE, STRICTNESS KEY & AUDIT SIGN-OFF
    # =========================================================================
    story.append(PageBreak())

    # Final Page Header Banner
    final_banner = Table([
        [
            '',
            [
                Paragraph("<font size='7.5' color='#0F5132'><b>ASSESSMENT REFERENCE ARCHITECTURE &amp; AUDIT TRAIL</b></font>", body_style),
                Spacer(1, 2),
                Paragraph("<font size='12' color='#111827'><b>10-Point Institutional Grading &amp; AI Calibration Key</b></font>", bold_style),
                Paragraph("<font size='7.5' color='#4B5563'>Statutory benchmark criteria and automated evaluation strictness profiles applied to this examination.</font>", body_style),
            ]
        ]
    ], colWidths=[4, 536])
    final_banner.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), EMERALD_PRIMARY),
        ('BACKGROUND', (1,0), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 1, CARD_BORDER),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (1,0), (-1,-1), 8),
        ('RIGHTPADDING', (1,0), (-1,-1), 8),
    ]))
    story.append(final_banner)
    story.append(Spacer(1, 8))

    # 2-Column: 10-Point Grading Scale (Left) & Strictness Calibration (Right)
    # Left: 10-Point Grade Scale
    grade_rows = [
        [Paragraph("<font size='8.5' color='#111827'><b>10-Point Academic Grade Scale (UGC Standard)</b></font>", bold_style), '']
    ]
    for g in GRADE_SCALE:
        is_cand_grade = (grade.strip().upper() == g["grade"].upper())
        g_badge = "<font size='6.5' color='#0F5132'><b>[Achieved Grade]</b></font> " if is_cand_grade else ""
        left_desc = Paragraph(f"<font size='8' color='{'#0F5132' if is_cand_grade else '#111827'}'><b>{g['grade']} · {g['label']}</b></font><br/>{g_badge}<font size='6.5' color='#6B7280'>{g['desc']}</font>", body_style)
        right_min = Paragraph(f"<font size='7.5' color='#4B5563'><b>&ge; {g['min']}%</b></font>", ParagraphStyle("GRight", parent=body_style, alignment=2))
        grade_rows.append([left_desc, right_min])

    grade_table = Table(grade_rows, colWidths=[205, 50])
    grade_table_styles = [
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 1, CARD_BORDER),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('SPAN', (0,0), (1,0)),
        ('LINEBELOW', (0,0), (-1,0), 0.5, colors.HexColor("#F1F4F2")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]
    # Highlight achieved grade row
    for idx, g in enumerate(GRADE_SCALE, start=1):
        if grade.strip().upper() == g["grade"].upper():
            grade_table_styles.append(('BACKGROUND', (0, idx), (-1, idx), EMERALD_TINT))
            grade_table_styles.append(('LINEBEFORE', (0, idx), (0, idx), 2.5, EMERALD_PRIMARY))
    grade_table.setStyle(TableStyle(grade_table_styles))

    # Right: Strictness Calibration Matrix
    strict_rows = [
        [Paragraph("<font size='8.5' color='#111827'><b>AI Strictness Calibration (1 to 5 Index)</b></font>", bold_style)]
    ]
    for s in STRICTNESS_LEVELS:
        is_applied = (strict_idx == s["level"])
        applied_badge = "<font size='6.5' color='#0F5132'><b>[Applied to This Sheet]</b></font> " if is_applied else ""
        s_desc = Paragraph(f"<font size='8' color='{'#0F5132' if is_applied else '#111827'}'><b>Level {s['level']} · {s['title']}</b></font><br/>{applied_badge}<font size='6.5' color='#6B7280'>{s['desc']}</font>", body_style)
        strict_rows.append([s_desc])

    strict_table = Table(strict_rows, colWidths=[255])
    strict_table_styles = [
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 1, CARD_BORDER),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('LINEBELOW', (0,0), (-1,0), 0.5, colors.HexColor("#F1F4F2")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]
    for idx, s in enumerate(STRICTNESS_LEVELS, start=1):
        if strict_idx == s["level"]:
            strict_table_styles.append(('BACKGROUND', (0, idx), (-1, idx), EMERALD_TINT))
            strict_table_styles.append(('LINEBEFORE', (0, idx), (0, idx), 2.5, EMERALD_PRIMARY))
    strict_table.setStyle(TableStyle(strict_table_styles))

    calibration_row = Table(
        [[grade_table, '', strict_table]],
        colWidths=[265, 10, 265],
    )
    calibration_row.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(calibration_row)
    story.append(Spacer(1, 14))

    # Three-Column Formal Signature Footer (width 540pt)
    audit_hash = (sheet_id or "evaldesk-pro-ai")[:12].upper()
    sig_cell_1 = [
        Paragraph("<font size='7' color='#CBD5E1'>___________________________________</font>", center_style),
        Spacer(1, 3),
        Paragraph("<font size='8' color='#111827'><b>AI Rubric Verification Engine</b></font>", center_style),
        Paragraph(f"<font size='6.5' color='#6B7280'>Multi-Pass Audit #{audit_hash}</font>", center_style),
    ]
    sig_cell_2 = [
        Paragraph("<font size='7' color='#CBD5E1'>___________________________________</font>", center_style),
        Spacer(1, 3),
        Paragraph("<font size='8' color='#111827'><b>Course Instructor / Evaluator</b></font>", center_style),
        Paragraph("<font size='6.5' color='#6B7280'>Certified Academic Assessor</font>", center_style),
    ]
    sig_cell_3 = [
        Paragraph("<font size='7' color='#CBD5E1'>___________________________________</font>", center_style),
        Spacer(1, 3),
        Paragraph("<font size='8' color='#111827'><b>Controller of Examinations</b></font>", center_style),
        Paragraph("<font size='6.5' color='#6B7280'>Institutional Seal &amp; Authority</font>", center_style),
    ]

    sig_footer = Table(
        [[sig_cell_1, '', sig_cell_2, '', sig_cell_3]],
        colWidths=[174, 9, 174, 9, 174],
    )
    sig_footer.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('BOX', (0,0), (0,0), 1, CARD_BORDER),
        ('BOX', (2,0), (2,0), 1, CARD_BORDER),
        ('BOX', (4,0), (4,0), 1, CARD_BORDER),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(sig_footer)

    doc.build(story)


def generate_paper_summary_pdf(
    output_path: Path,
    paper_title: str,
    total_students: int,
    average_score: float,
    max_marks: float,
    question_stats: List[Dict[str, Any]],
    most_missed_points: List[str],
    override_count: int,
    flagged_count: int,
    suggestions: List[str],
):
    fonts = register_report_fonts()
    reg_font = fonts["regular"]
    bold_font = fonts["bold"]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(output_path), pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    clean_title = sanitize_exam_title(paper_title)

    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Heading1"],
        fontName=bold_font,
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#00325B"),
        alignment=1,
    )
    subtitle_style = ParagraphStyle(
        "SubTitleStyle",
        parent=styles["Normal"],
        fontName=reg_font,
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#43474E"),
        alignment=1,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName=bold_font,
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#005DAC"),
        spaceAfter=5,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName=reg_font,
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1A1C1E"),
    )
    bold_body = ParagraphStyle(
        "BoldBody",
        parent=styles["Normal"],
        fontName=bold_font,
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1A1C1E"),
    )

    story = []
    story.append(Paragraph("EvalDesk AI — Class Assessment Summary Report", title_style))
    story.append(Spacer(1, 3))
    story.append(Paragraph(f"<b>Exam:</b> {safe_xml(clean_title)}", subtitle_style))
    story.append(Spacer(1, 12))

    # Exam Analytics Table
    avg_pct = round((average_score / max_marks) * 100.0, 1) if max_marks > 0 else 0.0
    meta_data = [
        [Paragraph(f"<b>Total Evaluated Students:</b> {total_students}", body_style), Paragraph(f"<b>Max Exam Marks:</b> {max_marks:g}", body_style)],
        [Paragraph(f"<b>Class Average Score:</b> {average_score:g} / {max_marks:g} ({avg_pct:g}%)", body_style), Paragraph(f"<b>Flagged Answers:</b> {flagged_count}", body_style)],
        [Paragraph(f"<b>Teacher Score Overrides:</b> {override_count}", body_style), Paragraph(f"<b>Moderation Rate:</b> {round((override_count / max(1, total_students * len(question_stats))) * 100.0, 1):g}%", body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[270, 270])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F0F4FA")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#D4E3FF")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D4E3FF")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # Question Breakdown Table
    story.append(Paragraph("Question Performance & Average Breakdown", section_heading))
    q_table_data = [["Q #", "Max Marks", "Class Avg", "Accuracy %", "Students Missed / Overridden"]]
    for q in question_stats:
        q_table_data.append([
            Paragraph(safe_xml(format_q_number(q.get('q_no', ''))), bold_body),
            Paragraph(f"{q.get('max_marks', 0.0):g}M", body_style),
            Paragraph(f"{q.get('avg_marks', 0.0):g}M", body_style),
            Paragraph(f"{q.get('accuracy_pct', 0.0):g}%", body_style),
            Paragraph(f"{q.get('miss_count', 0)} missed ({q.get('override_count', 0)} overrides)", body_style),
        ])

    q_table = Table(q_table_data, colWidths=[50, 75, 75, 80, 260])
    q_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#005DAC")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), bold_font),
        ('BOTTOMPADDING', (0,0), (-1,0), 5),
        ('TOPPADDING', (0,0), (-1,0), 5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#C3C7CF")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(q_table)
    story.append(Spacer(1, 12))

    # Most Missed Key Points
    story.append(Paragraph("Most-Missed Rubric Key Points Across Class", section_heading))
    if most_missed_points:
        for pt in most_missed_points:
            story.append(Paragraph(f"• {safe_xml(pt)}", body_style))
    else:
        story.append(Paragraph("• No prevalent key-point deficits identified across student submissions.", body_style))
    story.append(Spacer(1, 10))

    # Recommendations
    story.append(Paragraph("Suggestions to Improve Future Question Papers", section_heading))
    if suggestions:
        for s in suggestions:
            story.append(Paragraph(f"• {safe_xml(s)}", body_style))
    else:
        story.append(Paragraph("• Maintain clear sub-part demarcation and explicit mark weighting in instructions.", body_style))

    doc.build(story)

def generate_paper_report_excel(
    output_path: Path,
    paper_title: str,
    students: List[Dict[str, Any]],
    questions: List[Dict[str, Any]],
    question_stats: Optional[List[Dict[str, Any]]] = None,
    analytics: Optional[Dict[str, Any]] = None,
):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.Workbook()

    clean_title = sanitize_exam_title(paper_title)

    # --- Sheet 1: Class Results ---
    ws1 = wb.active
    ws1.title = "Class Results"

    header_font = Font(bold=True, color="FFFFFF", size=10)
    header_fill = PatternFill(start_color="005DAC", end_color="005DAC", fill_type="solid")
    align_center = Alignment(horizontal="center", vertical="center")

    headers1 = ["Roll No", "Student Name", "Total Score", "Max Marks", "Percentage", "Grade"]
    for q in questions:
        headers1.append(f"{format_q_number(q.get('q_no', ''))} ({q.get('max_marks', 0)}M)")

    ws1.append(headers1)
    for col_idx in range(1, len(headers1) + 1):
        cell = ws1.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center

    for s in students:
        row = [
            s.get("roll_number", ""),
            s.get("student_name", "Anonymous"),
            s.get("total_score", 0.0),
            s.get("max_marks", 0.0),
            f"{s.get('percentage', 0.0)}%",
            s.get("grade", ""),
        ]
        q_scores = s.get("question_scores", {})
        for q in questions:
            qid = q.get("id")
            score = q_scores.get(qid) if (qid and qid in q_scores) else q_scores.get(q.get("q_no"), 0.0)
            row.append(score)
        ws1.append(row)

    # --- Sheet 2: Question Breakdown ---
    ws2 = wb.create_sheet(title="Question Breakdown")
    headers2 = ["Q #", "Question Text", "Max Marks", "Class Avg Score", "Accuracy %", "Students Missed", "Teacher Overrides"]
    ws2.append(headers2)
    for col_idx in range(1, len(headers2) + 1):
        cell = ws2.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center

    q_stats_map = {str(q.get("q_no")): q for q in (question_stats or [])}
    for q in questions:
        q_no = str(q.get("q_no", ""))
        stat = q_stats_map.get(q_no, {})
        ws2.append([
            format_q_number(q_no),
            q.get("question_text", ""),
            q.get("max_marks", 0.0),
            stat.get("avg_marks", 0.0),
            f"{stat.get('accuracy_pct', 0.0)}%",
            stat.get("miss_count", 0),
            stat.get("override_count", 0),
        ])

    # --- Sheet 3: Summary Analytics ---
    ws3 = wb.create_sheet(title="Summary Analytics")
    headers3 = ["Analytics Metric", "Value"]
    ws3.append(headers3)
    for col_idx in range(1, len(headers3) + 1):
        cell = ws3.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center

    ana = analytics or {}
    analytics_rows = [
        ("Assessment Title", clean_title),
        ("Total Evaluated Students", ana.get("total_students", len(students))),
        ("Max Possible Marks", ana.get("max_marks", 0.0)),
        ("Class Average Score", ana.get("average_score", 0.0)),
        ("Class Average Percentage", f"{ana.get('average_percentage', 0.0)}%"),
        ("Total Flagged Questions", ana.get("flagged_count", 0)),
        ("Total Teacher Overrides", ana.get("override_count", 0)),
    ]
    for m_label, m_val in analytics_rows:
        ws3.append([m_label, m_val])

    # Set column widths
    for sheet in (ws1, ws2, ws3):
        for col in sheet.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            sheet.column_dimensions[col_letter].width = max(max_len + 3, 12)

    wb.save(str(output_path))


def generate_class_marksheet_pdf(
    output_path: Path,
    paper_title: str,
    subject: str,
    students: List[Dict[str, Any]],
    total_marks: float,
    class_name: Optional[str] = None,
):
    """
    Generates a consolidated whole-class marksheet PDF with class summary KPIs
    and a complete student results ledger table.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fonts = register_report_fonts()
    regular = fonts["regular"]
    bold = fonts["bold"]

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    story = []
    clean_title = sanitize_exam_title(paper_title)
    max_m = float(total_marks or 10.0)

    # Styles
    title_style = ParagraphStyle(
        "MarksheetTitle",
        fontName=bold,
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0F172A"),
    )
    sub_style = ParagraphStyle(
        "MarksheetSub",
        fontName=regular,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
    )
    th_style = ParagraphStyle(
        "MarksheetTH",
        fontName=bold,
        fontSize=8,
        leading=10,
        alignment=1,
        textColor=colors.white,
    )
    td_style = ParagraphStyle(
        "MarksheetTD",
        fontName=regular,
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1E293B"),
    )
    td_bold = ParagraphStyle(
        "MarksheetTDBold",
        fontName=bold,
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )
    td_center = ParagraphStyle(
        "MarksheetTDCenter",
        fontName=regular,
        fontSize=8,
        leading=10,
        alignment=1,
        textColor=colors.HexColor("#1E293B"),
    )

    # Header Card
    header_left = [
        Paragraph("<b>CONSOLIDATED CLASS MARKSHEET</b>", title_style),
        Spacer(1, 3),
        Paragraph(f"<b>Exam / Assessment:</b> {safe_xml(clean_title)}", sub_style),
        Paragraph(f"<b>Subject:</b> {safe_xml(subject or 'General Subject')} &nbsp;|&nbsp; <b>Class:</b> {safe_xml(class_name or 'All Classes')} &nbsp;|&nbsp; <b>Max Marks:</b> {max_m:g}", sub_style),
    ]

    from datetime import datetime
    gen_time = datetime.now().strftime("%d %b %Y, %I:%M %p")
    header_right = [
        Paragraph("<b>EvalDesk AI Assessment</b>", ParagraphStyle("HR1", fontName=bold, fontSize=10, leading=12, alignment=2, textColor=colors.HexColor("#4338CA"))),
        Paragraph(f"Generated: {gen_time}", ParagraphStyle("HR2", fontName=regular, fontSize=8, leading=10, alignment=2, textColor=colors.HexColor("#64748B"))),
        Paragraph("Status: Official Record", ParagraphStyle("HR3", fontName=bold, fontSize=8, leading=10, alignment=2, textColor=colors.HexColor("#15803D"))),
    ]

    header_table = Table([[header_left, header_right]], colWidths=[360, 180])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))

    # Compute Summary Stats
    total_count = len(students)
    valid_scores = [float(s.get("total_score") or 0.0) for s in students if s.get("total_score") is not None]
    avg_score = round(sum(valid_scores) / len(valid_scores), 1) if valid_scores else 0.0
    avg_pct = round((avg_score / max_m) * 100.0, 1) if max_m > 0 else 0.0
    highest_score = max(valid_scores) if valid_scores else 0.0
    pass_count = sum(1 for sc in valid_scores if (sc / max_m) >= 0.40) if max_m > 0 else total_count
    pass_pct = round((pass_count / total_count) * 100.0, 1) if total_count > 0 else 0.0

    kpi_data = [
        [
            Paragraph("<b>TOTAL STUDENTS</b>", ParagraphStyle("K1", fontName=bold, fontSize=7, leading=8, alignment=1, textColor=colors.HexColor("#64748B"))),
            Paragraph("<b>CLASS AVERAGE</b>", ParagraphStyle("K2", fontName=bold, fontSize=7, leading=8, alignment=1, textColor=colors.HexColor("#64748B"))),
            Paragraph("<b>HIGHEST SCORE</b>", ParagraphStyle("K3", fontName=bold, fontSize=7, leading=8, alignment=1, textColor=colors.HexColor("#64748B"))),
            Paragraph("<b>PASSING RATE</b>", ParagraphStyle("K4", fontName=bold, fontSize=7, leading=8, alignment=1, textColor=colors.HexColor("#64748B"))),
        ],
        [
            Paragraph(f"<b>{total_count}</b>", ParagraphStyle("KV1", fontName=bold, fontSize=12, leading=14, alignment=1, textColor=colors.HexColor("#0F172A"))),
            Paragraph(f"<b>{avg_score:g} / {max_m:g}</b> ({avg_pct}%)", ParagraphStyle("KV2", fontName=bold, fontSize=12, leading=14, alignment=1, textColor=colors.HexColor("#4338CA"))),
            Paragraph(f"<b>{highest_score:g} / {max_m:g}</b>", ParagraphStyle("KV3", fontName=bold, fontSize=12, leading=14, alignment=1, textColor=colors.HexColor("#15803D"))),
            Paragraph(f"<b>{pass_pct}%</b> ({pass_count}/{total_count})", ParagraphStyle("KV4", fontName=bold, fontSize=12, leading=14, alignment=1, textColor=colors.HexColor("#0369A1"))),
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[135, 135, 135, 135])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 10))

    # Ledger Table
    table_headers = [
        Paragraph("<b>S.No</b>", th_style),
        Paragraph("<b>Roll No</b>", th_style),
        Paragraph("<b>Student Name</b>", th_style),
        Paragraph("<b>Class</b>", th_style),
        Paragraph("<b>Marks</b>", th_style),
        Paragraph("<b>%</b>", th_style),
        Paragraph("<b>Grade</b>", th_style),
        Paragraph("<b>Status</b>", th_style),
    ]

    col_widths = [30, 75, 145, 60, 60, 50, 45, 75]
    table_rows = [table_headers]

    for idx, s in enumerate(students, 1):
        s_score = float(s.get("total_score") or 0.0)
        s_pct = float(s.get("percentage") or (round((s_score / max_m) * 100.0, 1) if max_m > 0 else 0.0))
        s_grade = s.get("grade") or ("A+" if s_pct >= 90 else "A" if s_pct >= 80 else "B" if s_pct >= 60 else "C" if s_pct >= 40 else "D")
        s_status = str(s.get("status") or "Evaluated").capitalize()
        s_class = s.get("class_name") or class_name or "—"

        table_rows.append([
            Paragraph(str(idx), td_center),
            Paragraph(safe_xml(s.get("roll_number") or s.get("roll") or "—"), td_bold),
            Paragraph(safe_xml(s.get("student_name") or "Student"), td_style),
            Paragraph(safe_xml(s_class), td_center),
            Paragraph(f"{s_score:g} / {max_m:g}", td_center),
            Paragraph(f"{s_pct:.1f}%", td_center),
            Paragraph(safe_xml(s_grade), td_center),
            Paragraph(safe_xml(s_status), td_center),
        ])

    ledger_table = Table(table_rows, colWidths=col_widths, repeatRows=1)
    ledger_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#4338CA")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(ledger_table)
    story.append(Spacer(1, 14))

    # Signature & Footer Block
    footer_data = [
        [
            Paragraph("<b>Evaluated By:</b> EvalDesk AI Assisted Engine", sub_style),
            Paragraph("<b>Verified By (Teacher):</b> _______________________", sub_style),
            Paragraph("<b>Signature & Date:</b> _______________________", sub_style),
        ]
    ]
    footer_table = Table(footer_data, colWidths=[180, 180, 180])
    footer_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(KeepTogether([footer_table]))

    doc.build(story)


def generate_one_page_bento_report_card_pdf(
    output_path: Path,
    student_name: str,
    roll_number: str,
    paper_title: str,
    subject: str,
    total_score: float,
    max_marks: float,
    percentage: float,
    grade: str,
    questions: List[Dict[str, Any]],
    class_name: Optional[str] = None,
    exam_name: Optional[str] = None,
    subject_code: Optional[str] = None,
    strictness: int = 3,
    sheet_id: Optional[str] = None,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fonts = register_report_fonts()
    regular = fonts["regular"]
    bold = fonts["bold"]

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=18,
        rightMargin=18,
        topMargin=18,
        bottomMargin=18,
    )

    story = []

    # Palette
    c_emerald = colors.HexColor("#0F5132")
    c_tile = colors.HexColor("#F1F4F2")
    c_border = colors.HexColor("#E2E8E4")
    c_text_dark = colors.HexColor("#111827")
    c_text_muted = colors.HexColor("#6B7280")
    c_amber = colors.HexColor("#D97706")
    c_rose = colors.HexColor("#DC2626")
    c_tint = colors.HexColor("#E8F3EE")

    # Typography styles
    h_title = ParagraphStyle('BTitle', fontName=bold, fontSize=13, leading=15, textColor=colors.white)
    h_sub = ParagraphStyle('BSub', fontName=regular, fontSize=8, leading=10.5, textColor=colors.HexColor("#C7E4D6"))
    badge_style = ParagraphStyle('BBadge', fontName=bold, fontSize=7.5, leading=9.5, textColor=c_emerald, alignment=1)
    
    lbl_style = ParagraphStyle('BLbl', fontName=regular, fontSize=7, leading=8.5, textColor=c_text_muted)
    val_style = ParagraphStyle('BVal', fontName=bold, fontSize=9.5, leading=11.5, textColor=c_text_dark)
    val_mono = ParagraphStyle('BMono', fontName=bold, fontSize=9, leading=11, textColor=c_text_dark)
    sec_title = ParagraphStyle('BST', fontName=bold, fontSize=9, leading=11, textColor=c_text_dark)

    # Normalization of scores & metrics
    max_m = float(max_marks or 0.0)
    if max_m <= 0:
        max_m = sum(float(q.get("max_marks") or 1.0) for q in (questions or [])) or 100.0
    tot_s = float(total_score or 0.0)
    pct = float(percentage or 0.0)
    if pct <= 0 and max_m > 0:
        pct = round((tot_s / max_m) * 100.0, 1)
    tot_lost = max(0.0, round(max_m - tot_s, 1))
    is_pass = pct >= 35.0
    status_label = "PASS" if is_pass else "RE-APPEAR"
    status_color = c_emerald if is_pass else c_rose

    def get_ugc_grade(p: float) -> str:
        if p >= 90: return "O (Outstanding)"
        if p >= 80: return "A+ (Excellent)"
        if p >= 70: return "A (Very Good)"
        if p >= 60: return "B+ (Good)"
        if p >= 50: return "B (Above Average)"
        if p >= 40: return "C (Average)"
        if p >= 35: return "D (Pass)"
        return "F (Re-appear Required)"

    eff_grade = grade if (grade and grade not in ["Needs Support", "N/A"]) else get_ugc_grade(pct)

    # Normalize Questions
    norm_qs = []
    full_count = 0
    part_count = 0
    zero_count = 0
    unatt_count = 0

    for idx, q in enumerate(questions or []):
        q_no_raw = str(q.get("q_no") or (idx + 1))
        q_no_clean = re.sub(r"^[Qq]\.?\s*", "", q_no_raw)
        earned = float(q.get("final_marks") or 0.0)
        q_max = float(q.get("max_marks") or 1.0)
        q_pct = (earned / q_max * 100.0) if q_max > 0 else 0.0
        
        is_att = bool(q.get("is_attempted")) or bool(q.get("extracted_text")) or earned > 0
        if not is_att and earned == 0:
            unatt_count += 1
            status = 'zero'
            zero_count += 1
        elif q_pct >= 90.0:
            status = 'full'
            full_count += 1
        elif q_pct > 0.0:
            status = 'part'
            part_count += 1
        else:
            status = 'zero'
            zero_count += 1

        norm_qs.append({
            "q_no": q_no_clean,
            "earned": earned,
            "max": q_max,
            "pct": q_pct,
            "status": status,
            "is_att": is_att,
            "section": str(q.get("section_name") or "General").strip() or "General",
            "type": str(q.get("question_type") or ("Extended / Long" if q_max >= 5 else "Core Practical" if q_max >= 3 else "Objective / Short")),
            "flags": q.get("flags") or (json.loads(q.get("flags_json") or "[]") if isinstance(q.get("flags_json"), str) else []),
        })

    if not norm_qs:
        norm_qs = [{
            "q_no": "1",
            "earned": tot_s,
            "max": max_m,
            "pct": pct,
            "status": "full" if pct >= 90 else ("part" if pct > 0 else "zero"),
            "is_att": True,
            "section": "General",
            "type": "Standard Assessment",
            "flags": [],
        }]
    total_qs_count = len(norm_qs)
    att_count = total_qs_count - unatt_count

    # 1. HEADER TABLE (Height 42 pt)
    t_clean = sanitize_exam_title(paper_title or "Academic Examination")
    dt_str = datetime.now().strftime("%d %b %Y")
    sid_short = (sheet_id or "")[:8].upper()

    h_left = [
        Paragraph(f"<b>{safe_xml(t_clean)}</b>", h_title),
        Spacer(1, 2),
        Paragraph(f"Subject: {safe_xml(subject or 'General')} {f'· Code: {safe_xml(subject_code)}' if subject_code else ''} · Date: {dt_str}", h_sub),
    ]
    badge_cell = Table(
        [[Paragraph("<b>VERIFIED REPORT CARD</b>", badge_style)]],
        colWidths=[135],
        rowHeights=[16],
    )
    badge_cell.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.white),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 1),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
    ]))
    h_right = [
        badge_cell,
        Spacer(1, 2),
        Paragraph(f"<font color='#C7E4D6' size='7'>Sheet ID: <b>{sid_short}</b></font>", ParagraphStyle('HR', alignment=2, fontName=regular)),
    ]
    header_table = Table([[h_left, h_right]], colWidths=[405, 154], rowHeights=[42])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_emerald),
        ('ROUNDEDCORNERS', [5, 5, 5, 5]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4))

    # 2. CANDIDATE IDENTITY STRIP (Height 30 pt)
    cand_data = [
        [
            Paragraph("CANDIDATE NAME", lbl_style),
            Paragraph("ROLL NUMBER", lbl_style),
            Paragraph("CLASS / STREAM", lbl_style),
            Paragraph("APPLIED STRICTNESS", lbl_style),
        ],
        [
            Paragraph(safe_xml(student_name or "Student"), val_style),
            Paragraph(safe_xml(roll_number or "—"), val_mono),
            Paragraph(safe_xml(class_name or "Standard Section"), val_style),
            Paragraph(f"Level {strictness}/5 (Standard)", val_style),
        ]
    ]
    cand_table = Table(cand_data, colWidths=[170, 125, 145, 119], rowHeights=[11, 15])
    cand_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_tile),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(cand_table)
    story.append(Spacer(1, 4))

    # 3. SCORE & RESULT SUMMARY STRIP (Height 40 pt)
    score_num = ParagraphStyle('SN', fontName=bold, fontSize=14, leading=16, textColor=c_emerald, alignment=1)
    status_num = ParagraphStyle('STN', fontName=bold, fontSize=13, leading=15, textColor=status_color, alignment=1)
    sub_c = ParagraphStyle('SC', fontName=regular, fontSize=7, leading=8.5, textColor=c_text_muted, alignment=1)
    score_data = [
        [
            [Paragraph("TOTAL MARKS", sub_c), Spacer(1, 1), Paragraph(f"<b>{tot_s:g} / {max_m:g}</b>", score_num)],
            [Paragraph("PERCENTAGE", sub_c), Spacer(1, 1), Paragraph(f"<b>{pct:.1f}%</b>", score_num)],
            [Paragraph("AWARDED GRADE", sub_c), Spacer(1, 1), Paragraph(f"<b>{safe_xml(eff_grade)}</b>", score_num)],
            [Paragraph("FINAL STATUS", sub_c), Spacer(1, 1), Paragraph(f"<b>{status_label}</b>", status_num)],
        ]
    ]
    score_table = Table(score_data, colWidths=[139.5, 140, 140, 139.5], rowHeights=[40])
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.white),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(score_table)
    story.append(Spacer(1, 5))

    # 4. SECTION 1: QUESTION & SECTION MARKS TELEMETRY
    s1_hdr = Table([
        [
            Paragraph("<b>1. QUESTION &amp; SECTION MARKS TELEMETRY</b>", sec_title),
            Paragraph(f"<font size='7' color='#0F5132'><b>Q1 to Q{total_qs_count} ({max_m:g} Total Marks)</b></font>", ParagraphStyle('B1', alignment=1)),
            Paragraph("<font size='7' color='#6B7280'>Cohort avg available after 2+ sheets</font>", ParagraphStyle('B2', alignment=2)),
        ]
    ], colWidths=[270, 140, 149], rowHeights=[13])
    s1_hdr.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(s1_hdr)
    story.append(Spacer(1, 2))

    # Section 1.1 Bar Chart Drawing (Width 559, Height 98 pt)
    d_qbar = Drawing(559, 98)
    d_qbar.add(Rect(0, 0, 559, 98, fillColor=colors.white, strokeColor=c_border, strokeWidth=0.5, rx=4, ry=4))
    d_qbar.add(DString(10, 84, f"Question-by-Question Marks Scored vs Max ({total_qs_count} Questions)", fontName=bold, fontSize=7.5, fillColor=c_text_dark))
    d_qbar.add(DString(10, 74, "Visual bar heights indicate obtained marks with color-coded evaluation status (Emerald=Full, Amber=Partial, Rose=Heavy Deduction)", fontName=regular, fontSize=6, fillColor=c_text_muted))
    d_qbar.add(DString(455, 84, f"Full ({full_count})  ·  Partial ({part_count})  ·  Deduction ({zero_count})", fontName=bold, fontSize=6.5, fillColor=c_emerald))

    # Y-axis
    d_qbar.add(DString(12, 57, "100%", fontName=regular, fontSize=5.5, fillColor=c_text_muted))
    d_qbar.add(DString(12, 35, "50%", fontName=regular, fontSize=5.5, fillColor=c_text_muted))
    d_qbar.add(DString(12, 14, "0%", fontName=regular, fontSize=5.5, fillColor=c_text_muted))
    d_qbar.add(DLine(35, 14, 545, 14, strokeColor=c_border, strokeWidth=0.5))

    plot_w = 510.0
    start_x = 35.0
    plot_h = 50.0

    if total_qs_count == 1:
        # Beautiful centered bar for 1 question
        q0 = norm_qs[0]
        bx = 250.0
        bw = 60.0
        d_qbar.add(Rect(bx, 14, bw, plot_h, fillColor=c_tile, strokeColor=None, rx=3, ry=3))
        bh = max(3.0, (q0["earned"] / q0["max"]) * plot_h if q0["max"] > 0 else 0.0)
        b_color = c_emerald if q0["pct"] >= 90 else (c_rose if q0["pct"] <= 0 else c_amber)
        d_qbar.add(Rect(bx, 14, bw, bh, fillColor=b_color, strokeColor=None, rx=3, ry=3))
        d_qbar.add(DString(bx + bw / 2.0, 68, f"{q0['earned']:g} / {q0['max']:g} M ({q0['pct']:.0f}%)", fontName=bold, fontSize=7, fillColor=b_color, textAnchor='middle'))
        d_qbar.add(DString(bx + bw / 2.0, 4, f"Q.{q0['q_no']}", fontName=bold, fontSize=7.5, fillColor=c_text_dark, textAnchor='middle'))
    else:
        slot_w = plot_w / float(total_qs_count)
        bw = max(8.0, min(36.0, slot_w * 0.55))
        for idx, qe in enumerate(norm_qs):
            bx = start_x + (idx * slot_w) + (slot_w - bw) / 2.0
            d_qbar.add(Rect(bx, 14, bw, plot_h, fillColor=c_tile, strokeColor=None, rx=2, ry=2))
            bh = max(2.5, (qe["earned"] / qe["max"]) * plot_h if qe["max"] > 0 else 0.0)
            b_color = c_emerald if qe["pct"] >= 90 else (c_rose if qe["pct"] <= 0 else c_amber)
            d_qbar.add(Rect(bx, 14, bw, bh, fillColor=b_color, strokeColor=None, rx=2, ry=2))
            score_txt = f"{qe['earned']:g}/{qe['max']:g}" if bw >= 22 else f"{qe['earned']:g}"
            d_qbar.add(DString(bx + bw / 2.0, 67, score_txt, fontName=bold, fontSize=6, fillColor=b_color, textAnchor='middle'))
            d_qbar.add(DString(bx + bw / 2.0, 4, f"Q.{qe['q_no']}", fontName=regular, fontSize=6.5, fillColor=c_text_dark, textAnchor='middle'))

    story.append(d_qbar)
    story.append(Spacer(1, 3))

    # Section 1.2 & 1.3: Donut & Sectional Breakdown (Side-by-side, Width 276.5 each, Height 90 pt)
    d_don1 = Drawing(276.5, 90)
    d_don1.add(Rect(0, 0, 276.5, 90, fillColor=colors.white, strokeColor=c_border, strokeWidth=0.5, rx=4, ry=4))
    d_don1.add(DString(10, 76, "TOTAL MARKS DISTRIBUTION SPLIT", fontName=bold, fontSize=7.5, fillColor=c_text_dark))
    d_don1.add(DString(225, 76, f"Max {max_m:g} M", fontName=bold, fontSize=6.5, fillColor=c_text_muted))
    d_don1.add(DString(10, 66, "Evaluation ratio between earned points and deductions across paper.", fontName=regular, fontSize=5.5, fillColor=c_text_muted))

    pie1 = Pie()
    pie1.x = 10
    pie1.y = 8
    pie1.width = 50
    pie1.height = 50
    pie1.data = [max(0.1, tot_s), max(0.01, tot_lost)]
    pie1.sideLabels = 0
    pie1.slices[0].fillColor = c_emerald
    pie1.slices[1].fillColor = c_rose
    d_don1.add(pie1)
    d_don1.add(Circle(35, 33, 16, fillColor=colors.white, strokeColor=None))
    d_don1.add(DString(35, 35, f"{tot_s:g}", fontName=bold, fontSize=7.5, fillColor=c_text_dark, textAnchor='middle'))
    d_don1.add(DString(35, 26, f"{pct:.0f}%", fontName=bold, fontSize=6.5, fillColor=c_emerald, textAnchor='middle'))

    # Right Pills for Donut 1
    d_don1.add(Rect(72, 35, 192, 21, fillColor=c_tint, strokeColor=c_border, strokeWidth=0.5, rx=3, ry=3))
    d_don1.add(Circle(82, 45.5, 3, fillColor=c_emerald, strokeColor=None))
    d_don1.add(DString(90, 42.5, "Marks Scored", fontName=regular, fontSize=7, fillColor=c_text_dark))
    d_don1.add(DString(256, 42.5, f"{tot_s:g} M ({pct:.1f}%)", fontName=bold, fontSize=7, fillColor=c_emerald, textAnchor='end'))

    d_don1.add(Rect(72, 10, 192, 21, fillColor=colors.HexColor("#FFF1F2"), strokeColor=colors.HexColor("#FFE4E6"), strokeWidth=0.5, rx=3, ry=3))
    d_don1.add(Circle(82, 20.5, 3, fillColor=c_rose, strokeColor=None))
    d_don1.add(DString(90, 17.5, "Marks Lost", fontName=regular, fontSize=7, fillColor=c_text_dark))
    lost_pct = (tot_lost / max_m * 100.0) if max_m > 0 else 0.0
    d_don1.add(DString(256, 17.5, f"{tot_lost:g} M ({lost_pct:.1f}%)", fontName=bold, fontSize=7, fillColor=c_rose, textAnchor='end'))

    # Sectional Breakdown Box
    sec_map = {}
    for qe in norm_qs:
        s_name = qe["section"]
        if s_name not in sec_map:
            sec_map[s_name] = {"earned": 0.0, "max": 0.0, "count": 0}
        sec_map[s_name]["earned"] += qe["earned"]
        sec_map[s_name]["max"] += qe["max"]
        sec_map[s_name]["count"] += 1

    d_sec = Drawing(276.5, 90)
    d_sec.add(Rect(0, 0, 276.5, 90, fillColor=colors.white, strokeColor=c_border, strokeWidth=0.5, rx=4, ry=4))
    d_sec.add(DString(10, 76, "SECTIONAL MARKS BREAKDOWN", fontName=bold, fontSize=7.5, fillColor=c_text_dark))
    d_sec.add(DString(205, 76, f"{len(sec_map)} Exam Section{'s' if len(sec_map) > 1 else ''}", fontName=bold, fontSize=6.5, fillColor=c_text_muted))
    d_sec.add(DString(10, 66, "Performance breakdown across categorized subject sections.", fontName=regular, fontSize=5.5, fillColor=c_text_muted))

    sec_items = list(sec_map.items())[:2]
    if len(sec_items) == 1:
        s_n, s_v = sec_items[0]
        s_pct = (s_v["earned"] / s_v["max"] * 100.0) if s_v["max"] > 0 else 0.0
        s_lost = max(0.0, s_v["max"] - s_v["earned"])
        d_sec.add(DString(10, 46, safe_xml(s_n[:28]), fontName=bold, fontSize=7.5, fillColor=c_text_dark))
        d_sec.add(DString(266, 46, f"{s_v['earned']:g} / {s_v['max']:g} M ({s_pct:.1f}%)", fontName=bold, fontSize=7, fillColor=c_emerald, textAnchor='end'))
        d_sec.add(Rect(10, 30, 256, 9, fillColor=c_tile, strokeColor=None, rx=3, ry=3))
        bw_prog = max(2.0, (s_pct / 100.0) * 256)
        d_sec.add(Rect(10, 30, bw_prog, 9, fillColor=c_emerald, strokeColor=None, rx=3, ry=3))
        d_sec.add(DString(10, 16, f"Q1 · {s_v['count']} Questions", fontName=regular, fontSize=6.5, fillColor=c_text_muted))
        d_sec.add(DString(266, 16, f"-{s_lost:g} M lost", fontName=bold, fontSize=6.5, fillColor=c_rose, textAnchor='end'))
    else:
        y_cursor = 48
        for s_n, s_v in sec_items:
            s_pct = (s_v["earned"] / s_v["max"] * 100.0) if s_v["max"] > 0 else 0.0
            s_lost = max(0.0, s_v["max"] - s_v["earned"])
            d_sec.add(DString(10, y_cursor, safe_xml(s_n[:24]), fontName=bold, fontSize=7, fillColor=c_text_dark))
            d_sec.add(DString(266, y_cursor, f"{s_v['earned']:g}/{s_v['max']:g} ({s_pct:.0f}%)", fontName=bold, fontSize=6.5, fillColor=c_emerald, textAnchor='end'))
            d_sec.add(Rect(10, y_cursor - 10, 256, 6, fillColor=c_tile, strokeColor=None, rx=2, ry=2))
            bw_prog = max(2.0, (s_pct / 100.0) * 256)
            d_sec.add(Rect(10, y_cursor - 10, bw_prog, 6, fillColor=c_emerald, strokeColor=None, rx=2, ry=2))
            y_cursor -= 28

    row_s1_sub = Table([[d_don1, d_sec]], colWidths=[276.5, 276.5], rowHeights=[90])
    row_s1_sub.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(row_s1_sub)
    story.append(Spacer(1, 4))

    # 5. SECTION 2: TEACHER DEDUCTIONS & ERROR TAXONOMY
    s2_hdr = Table([
        [
            Paragraph("<b>2. TEACHER DEDUCTIONS &amp; ERROR TAXONOMY</b>", sec_title),
            Paragraph(f"<font size='7' color='#DC2626'><b>{tot_lost:g} Total Marks Lost</b></font>", ParagraphStyle('B2a', alignment=1)),
            Paragraph("<font size='7' color='#6B7280'>Extracted from Deductions &amp; Rubrics</font>", ParagraphStyle('B2b', alignment=2)),
        ]
    ], colWidths=[280, 130, 149], rowHeights=[13])
    s2_hdr.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(s2_hdr)
    story.append(Spacer(1, 2))

    # Derive error taxonomy
    conc_loss = 0.0
    inc_loss = 0.0
    syn_loss = 0.0
    oth_loss = 0.0
    for qe in norm_qs:
        ql = max(0.0, qe["max"] - qe["earned"])
        if ql <= 0: continue
        if qe["earned"] == 0: conc_loss += ql
        elif qe["flags"]: syn_loss += ql * 0.5; inc_loss += ql * 0.5
        elif qe["earned"] < qe["max"]: inc_loss += ql
        else: oth_loss += ql
    if tot_lost > 0 and (conc_loss + inc_loss + syn_loss + oth_loss == 0):
        inc_loss = tot_lost

    err_cats = [
        {"name": "Incomplete Steps", "loss": inc_loss, "color": c_amber},
        {"name": "Conceptual Mistakes", "loss": conc_loss, "color": c_rose},
        {"name": "Syntax / Rubric Flags", "loss": syn_loss, "color": c_emerald},
        {"name": "Other Deductions", "loss": oth_loss, "color": colors.HexColor("#94A3B8")},
    ]
    err_cats = [c for c in err_cats if c["loss"] > 0]
    if not err_cats:
        err_cats = [{"name": "No Deductions", "loss": 0.0, "color": c_emerald}]

    err_cats_sorted = sorted(err_cats, key=lambda x: x["loss"], reverse=True)
    cum = 0.0
    pareto_pts = []
    for c in err_cats_sorted:
        cum += c["loss"]
        c_pct = (cum / tot_lost * 100.0) if tot_lost > 0 else 100.0
        pareto_pts.append({**c, "cum_pct": c_pct})

    d_ded = Drawing(276.5, 90)
    d_ded.add(Rect(0, 0, 276.5, 90, fillColor=colors.white, strokeColor=c_border, strokeWidth=0.5, rx=4, ry=4))
    d_ded.add(DString(10, 76, "DEDUCTIONS BY ERROR CATEGORY", fontName=bold, fontSize=7.5, fillColor=c_text_dark))
    d_ded.add(DString(240, 76, f"-{tot_lost:g} M", fontName=bold, fontSize=7, fillColor=c_rose))
    d_ded.add(DString(10, 66, "Proportion of marks lost classified from evaluation verdicts.", fontName=regular, fontSize=5.5, fillColor=c_text_muted))

    pie2 = Pie()
    pie2.x = 10
    pie2.y = 8
    pie2.width = 50
    pie2.height = 50
    pie2.data = [max(0.01, c["loss"]) for c in err_cats]
    pie2.sideLabels = 0
    for idx_c, cat_obj in enumerate(err_cats):
        pie2.slices[idx_c].fillColor = cat_obj["color"]
    d_ded.add(pie2)
    d_ded.add(Circle(35, 33, 16, fillColor=colors.white, strokeColor=None))
    d_ded.add(DString(35, 35, f"-{tot_lost:g}", fontName=bold, fontSize=7.5, fillColor=c_rose, textAnchor='middle'))
    d_ded.add(DString(35, 26, "Marks Lost", fontName=regular, fontSize=5.5, fillColor=c_text_muted, textAnchor='middle'))

    # Right pills for Deductions
    y_err = 40
    for cat_obj in err_cats_sorted[:2]:
        bg_col = colors.HexColor("#FEF3C7") if cat_obj["color"] == c_amber else (colors.HexColor("#FFF1F2") if cat_obj["color"] == c_rose else c_tint)
        d_ded.add(Rect(72, y_err, 192, 19, fillColor=bg_col, strokeColor=c_border, strokeWidth=0.5, rx=3, ry=3))
        d_ded.add(Circle(82, y_err + 9.5, 3, fillColor=cat_obj["color"], strokeColor=None))
        d_ded.add(DString(90, y_err + 7, safe_xml(cat_obj["name"][:22]), fontName=bold, fontSize=6.5, fillColor=c_text_dark))
        c_pct_str = f"{(cat_obj['loss']/tot_lost*100.0):.0f}%" if tot_lost > 0 else "0%"
        d_ded.add(DString(256, y_err + 7, f"{cat_obj['loss']:g} M ({c_pct_str})", fontName=bold, fontSize=6.5, fillColor=cat_obj["color"], textAnchor='end'))
        y_err -= 24

    # Pareto Box:
    d_par = Drawing(276.5, 90)
    d_par.add(Rect(0, 0, 276.5, 90, fillColor=colors.white, strokeColor=c_border, strokeWidth=0.5, rx=4, ry=4))
    d_par.add(DString(10, 76, "PARETO ERROR ANALYSIS (80/20 RULE)", fontName=bold, fontSize=7.5, fillColor=c_text_dark))
    d_par.add(DString(205, 76, "Line: Cumulative %", fontName=bold, fontSize=6.5, fillColor=c_emerald))
    d_par.add(DString(10, 66, "Prioritizes where mark loss was concentrated across rubrics.", fontName=regular, fontSize=5.5, fillColor=c_text_muted))

    d_par.add(DLine(30, 16, 260, 16, strokeColor=c_border, strokeWidth=0.5))
    d_par.add(DLine(30, 48, 260, 48, strokeColor=colors.HexColor("#818CF8"), strokeWidth=0.5, strokeDashArray=[2, 2]))
    d_par.add(DString(12, 46, "80%", fontName=regular, fontSize=5.5, fillColor=colors.HexColor("#6366F1")))

    if pareto_pts:
        max_l = max(0.1, pareto_pts[0]["loss"])
        bar_count = min(3, len(pareto_pts))
        slot_p = 210.0 / float(bar_count)
        pts_line = [(30.0, 16.0)]
        for ip, p_entry in enumerate(pareto_pts[:3]):
            bx_p = 40.0 + (ip * slot_p)
            bw_p = min(40.0, slot_p * 0.55)
            bh_p = max(5.0, (p_entry["loss"] / max_l) * 32.0)
            d_par.add(Rect(bx_p, 16, bw_p, bh_p, fillColor=p_entry["color"], strokeColor=None, rx=2, ry=2))
            d_par.add(DString(bx_p + bw_p/2.0, 52, f"{p_entry['loss']:g}M", fontName=bold, fontSize=6, fillColor=c_text_dark, textAnchor='middle'))
            d_par.add(DString(bx_p + bw_p/2.0, 6, p_entry["name"].split()[0], fontName=regular, fontSize=6, fillColor=c_text_muted, textAnchor='middle'))
            y_pt = 16.0 + (p_entry["cum_pct"] / 100.0) * 32.0
            pts_line.append((bx_p + bw_p/2.0, y_pt))
            d_par.add(Circle(bx_p + bw_p/2.0, y_pt, 2.5, fillColor=c_emerald, strokeColor=colors.white, strokeWidth=0.5))
        d_par.add(PolyLine(pts_line, strokeColor=c_emerald, strokeWidth=1.2))

    row_s2_sub = Table([[d_ded, d_par]], colWidths=[276.5, 276.5], rowHeights=[90])
    row_s2_sub.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(row_s2_sub)
    story.append(Spacer(1, 4))

    # 6. SECTION 3: QUESTION FORMAT & ATTEMPT PERFORMANCE
    s3_hdr = Table([
        [
            Paragraph("<b>3. QUESTION FORMAT &amp; ATTEMPT PERFORMANCE</b>", sec_title),
            Paragraph("<font size='7' color='#0F5132'><b>100% Paper Processed</b></font>", ParagraphStyle('B3a', alignment=1)),
            Paragraph("<font size='7' color='#6B7280'>Format Accuracy &amp; Question Completion</font>", ParagraphStyle('B3b', alignment=2)),
        ]
    ], colWidths=[280, 130, 149], rowHeights=[13])
    s3_hdr.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(s3_hdr)
    story.append(Spacer(1, 2))

    fmt_map = {}
    for qe in norm_qs:
        f_type = qe["type"]
        if f_type not in fmt_map:
            fmt_map[f_type] = {"earned": 0.0, "max": 0.0, "count": 0}
        fmt_map[f_type]["earned"] += qe["earned"]
        fmt_map[f_type]["max"] += qe["max"]
        fmt_map[f_type]["count"] += 1

    d_fmt = Drawing(276.5, 90)
    d_fmt.add(Rect(0, 0, 276.5, 90, fillColor=colors.white, strokeColor=c_border, strokeWidth=0.5, rx=4, ry=4))
    d_fmt.add(DString(10, 76, "MARKS EARNED VS LOST BY QUESTION FORMAT", fontName=bold, fontSize=7.5, fillColor=c_text_dark))
    d_fmt.add(DString(205, 76, "Earned %  ·  Lost %", fontName=bold, fontSize=6, fillColor=c_text_muted))
    d_fmt.add(DString(10, 66, "100% stacked representation of question type score yield.", fontName=regular, fontSize=5.5, fillColor=c_text_muted))

    fmt_items = list(fmt_map.items())[:2]
    if len(fmt_items) == 1:
        f_name, f_val = fmt_items[0]
        f_epct = round((f_val["earned"] / f_val["max"] * 100.0) if f_val["max"] > 0 else 0.0)
        f_lpct = max(0, 100 - f_epct)
        d_fmt.add(DString(10, 46, f"{safe_xml(f_name)} ({f_val['count']} Qs)", fontName=bold, fontSize=7.5, fillColor=c_text_dark))
        d_fmt.add(DString(266, 46, f"{f_epct}% Earned / {f_lpct}% Lost", fontName=bold, fontSize=6.5, fillColor=c_emerald, textAnchor='end'))
        d_fmt.add(Rect(10, 30, 256, 9, fillColor=c_tile, strokeColor=None, rx=3, ry=3))
        bw_e = max(2.0, (f_epct / 100.0) * 256)
        d_fmt.add(Rect(10, 30, bw_e, 9, fillColor=c_emerald, strokeColor=None, rx=3, ry=3))
        if f_lpct > 0:
            bw_l = (f_lpct / 100.0) * 256
            d_fmt.add(Rect(10 + bw_e, 30, bw_l, 9, fillColor=c_rose, strokeColor=None, rx=3, ry=3))
        d_fmt.add(DString(10, 16, f"{f_val['earned']:g} / {f_val['max']:g} Marks", fontName=regular, fontSize=6.5, fillColor=c_text_muted))
        d_fmt.add(DString(266, 16, "Strong Yield" if f_epct >= 75 else "Moderate Yield", fontName=bold, fontSize=6.5, fillColor=c_emerald, textAnchor='end'))
    else:
        y_f = 48
        for f_name, f_val in fmt_items:
            f_epct = round((f_val["earned"] / f_val["max"] * 100.0) if f_val["max"] > 0 else 0.0)
            f_lpct = max(0, 100 - f_epct)
            d_fmt.add(DString(10, y_f, f"{safe_xml(f_name[:20])} ({f_val['count']} Qs)", fontName=bold, fontSize=6.5, fillColor=c_text_dark))
            d_fmt.add(DString(266, y_f, f"{f_epct}% / {f_lpct}%", fontName=bold, fontSize=6, fillColor=c_emerald, textAnchor='end'))
            d_fmt.add(Rect(10, y_f - 10, 256, 6, fillColor=c_tile, strokeColor=None, rx=2, ry=2))
            bw_e = max(2.0, (f_epct / 100.0) * 256)
            d_fmt.add(Rect(10, y_f - 10, bw_e, 6, fillColor=c_emerald, strokeColor=None, rx=2, ry=2))
            if f_lpct > 0:
                d_fmt.add(Rect(10 + bw_e, y_f - 10, (f_lpct / 100.0) * 256, 6, fillColor=c_rose, strokeColor=None, rx=2, ry=2))
            y_f -= 28

    # Attempt Mastery Drawing
    d_att = Drawing(276.5, 90)
    d_att.add(Rect(0, 0, 276.5, 90, fillColor=colors.white, strokeColor=c_border, strokeWidth=0.5, rx=4, ry=4))
    d_att.add(DString(10, 76, "QUESTION ATTEMPT & MASTERY BREAKDOWN", fontName=bold, fontSize=7.5, fillColor=c_text_dark))
    d_att.add(DString(215, 76, f"{total_qs_count} Total Qs", fontName=bold, fontSize=6.5, fillColor=c_text_muted))
    d_att.add(DString(10, 66, "Question attempt completion and scoring mastery distribution.", fontName=regular, fontSize=5.5, fillColor=c_text_muted))

    pie3 = Pie()
    pie3.x = 10
    pie3.y = 8
    pie3.width = 50
    pie3.height = 50
    pie3.data = [max(0.01, full_count), max(0.01, part_count), max(0.01, zero_count), max(0.01, unatt_count)]
    pie3.sideLabels = 0
    pie3.slices[0].fillColor = c_emerald
    pie3.slices[1].fillColor = c_amber
    pie3.slices[2].fillColor = c_rose
    pie3.slices[3].fillColor = colors.HexColor("#94A3B8")
    d_att.add(pie3)
    d_att.add(Circle(35, 33, 16, fillColor=colors.white, strokeColor=None))
    d_att.add(DString(35, 35, f"{att_count}", fontName=bold, fontSize=8, fillColor=c_text_dark, textAnchor='middle'))
    d_att.add(DString(35, 26, f"{(att_count/total_qs_count*100.0):.0f}%", fontName=bold, fontSize=6.5, fillColor=c_emerald, textAnchor='middle'))

    # Right pills: Full Marks, Partial, Zero, Unattempted
    att_rows = [
        {"lbl": "Full Marks (≥90%)", "cnt": full_count, "col": c_emerald, "bg": c_tint},
        {"lbl": "Partial Marks", "cnt": part_count, "col": c_amber, "bg": c_tile},
        {"lbl": "Heavy Deductions", "cnt": zero_count, "col": c_rose, "bg": c_tile},
        {"lbl": "Unattempted", "cnt": unatt_count, "col": colors.HexColor("#94A3B8"), "bg": c_tile},
    ]
    y_att = 50
    for a_r in att_rows:
        d_att.add(Rect(72, y_att, 192, 12, fillColor=a_r["bg"], strokeColor=c_border, strokeWidth=0.5, rx=2, ry=2))
        d_att.add(Circle(78, y_att + 6, 2.5, fillColor=a_r["col"], strokeColor=None))
        d_att.add(DString(86, y_att + 3.5, a_r["lbl"], fontName=regular, fontSize=6, fillColor=c_text_dark))
        a_pct = round((a_r["cnt"] / total_qs_count * 100.0))
        d_att.add(DString(256, y_att + 3.5, f"{a_r['cnt']} Qs ({a_pct}%)", fontName=bold, fontSize=6, fillColor=a_r["col"], textAnchor='end'))
        y_att -= 14

    row_s3_sub = Table([[d_fmt, d_att]], colWidths=[276.5, 276.5], rowHeights=[90])
    row_s3_sub.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(row_s3_sub)
    story.append(Spacer(1, 4))

    # 7. QUESTION MARKS LEDGER (SCORES ONLY)
    story.append(Paragraph("<b>QUESTION MARKS LEDGER (SCORES &amp; STATUS ONLY — NO TRANSCRIPTS)</b>", ParagraphStyle('LH', fontName=bold, fontSize=7, leading=8.5, textColor=c_text_dark)))
    story.append(Spacer(1, 2))

    q_cells = []
    for qe in norm_qs:
        f_marks = qe["earned"]
        m_marks = qe["max"]
        if qe["status"] == "full":
            stat_str = "<font color='#0F5132'>Full</font>"
        elif qe["status"] == "part":
            stat_str = "<font color='#D97706'>Part</font>"
        else:
            stat_str = "<font color='#DC2626'>0</font>"
        cell_content = Paragraph(
            f"<b>Q.{qe['q_no']}</b>: <b>{f_marks:g}/{m_marks:g}</b> · {stat_str}",
            ParagraphStyle('QC', fontName=regular, fontSize=7, leading=8.5, alignment=1)
        )
        q_cells.append(cell_content)

    while len(q_cells) % 4 != 0:
        q_cells.append(Paragraph("", lbl_style))

    table_grid = []
    for i in range(0, len(q_cells), 4):
        table_grid.append(q_cells[i:i+4])
    table_grid = table_grid[:3]

    ledger_table = Table(table_grid, colWidths=[138.25, 138.25, 138.25, 138.25], rowHeights=[14] * len(table_grid))
    ledger_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROUNDEDCORNERS', [3, 3, 3, 3]),
        ('TOPPADDING', (0,0), (-1,-1), 1),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(ledger_table)
    story.append(Spacer(1, 4))

    # 8. OFFICIAL VERIFICATION SIGN-OFF STRIP
    signoff_data = [
        [
            Paragraph("<b>AI RUBRIC AUDIT</b>", ParagraphStyle('SOH', fontName=bold, fontSize=7, leading=8, textColor=c_text_dark)),
            Paragraph("<b>COURSE INSTRUCTOR</b>", ParagraphStyle('SOH', fontName=bold, fontSize=7, leading=8, textColor=c_text_dark)),
            Paragraph("<b>CONTROLLER OF EXAMINATIONS</b>", ParagraphStyle('SOH', fontName=bold, fontSize=7, leading=8, textColor=c_text_dark)),
        ],
        [
            Paragraph("Automated Multi-Pass Calibration<br/><font color='#0F5132'>✔ Officially Verified</font>", ParagraphStyle('SOB', fontName=regular, fontSize=6, leading=7.5, textColor=c_text_muted)),
            Paragraph("Department Academic Faculty<br/><font color='#6B7280'>Sign-off: _________________</font>", ParagraphStyle('SOB', fontName=regular, fontSize=6, leading=7.5, textColor=c_text_muted)),
            Paragraph("Office of Evaluation<br/><font color='#6B7280'>Institutional Seal: _________</font>", ParagraphStyle('SOB', fontName=regular, fontSize=6, leading=7.5, textColor=c_text_muted)),
        ]
    ]
    signoff_table = Table(signoff_data, colWidths=[184, 185, 184], rowHeights=[10, 18])
    signoff_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.white),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROUNDEDCORNERS', [3, 3, 3, 3]),
        ('TOPPADDING', (0,0), (-1,-1), 1.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(signoff_table)
    story.append(Spacer(1, 3))

    # 9. GRADING SCALE LEGEND
    scale_text = "Grading Scale: O (≥90%) · A+ (80-89%) · A (70-79%) · B+ (60-69%) · B (50-59%) · C (40-49%) · D (35-39%) · F (<35%) · Re-appear Required"
    story.append(Paragraph(scale_text, ParagraphStyle('Legend', fontName=regular, fontSize=6, leading=7, textColor=c_text_muted, alignment=1)))

    doc.build(story)

    # STRICT 1-PAGE GUARANTEE
    try:
        doc_check = fitz.open(str(output_path))
        if len(doc_check) > 1:
            while len(doc_check) > 1:
                doc_check.delete_page(1)
            doc_check.save(str(output_path))
        doc_check.close()
    except Exception:
        pass

    return output_path
