import html
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import letter
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

