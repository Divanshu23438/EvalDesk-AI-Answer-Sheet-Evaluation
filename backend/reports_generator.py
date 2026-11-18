import html
import re
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
):
    fonts = register_report_fonts()
    reg_font = fonts["regular"]
    bold_font = fonts["bold"]

    # Defensive deduplication of questions by question_id or eval_id
    seen_ids = set()
    deduped_questions = []
    for q in questions:
        qid = str(q.get("question_id") or q.get("eval_id") or q.get("q_no"))
        if qid not in seen_ids:
            seen_ids.add(qid)
            deduped_questions.append(q)
    questions = deduped_questions

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(output_path), pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    clean_title = sanitize_exam_title(paper_title)

    title_style = ParagraphStyle(
        "CardTitle",
        parent=styles["Heading1"],
        fontName=bold_font,
        fontSize=17,
        leading=21,
        textColor=colors.HexColor("#00325B"),
        alignment=1,
    )
    subtitle_style = ParagraphStyle(
        "CardSubTitle",
        parent=styles["Normal"],
        fontName=reg_font,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569"),
        alignment=1,
    )
    sec_head_style = ParagraphStyle(
        "SecHeading",
        parent=styles["Normal"],
        fontName=bold_font,
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#0F172A"),
    )
    sec_subtotal_style = ParagraphStyle(
        "SecSubtotal",
        parent=styles["Normal"],
        fontName=bold_font,
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#005DAC"),
        alignment=2,
    )
    body_style = ParagraphStyle(
        "CardBody",
        parent=styles["Normal"],
        fontName=reg_font,
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1E293B"),
    )
    bold_style = ParagraphStyle(
        "CardBold",
        parent=styles["Normal"],
        fontName=bold_font,
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#0F172A"),
    )
    center_style = ParagraphStyle(
        "CardCenter",
        parent=styles["Normal"],
        fontName=reg_font,
        fontSize=8.5,
        leading=12,
        alignment=1,
    )
    right_bold_style = ParagraphStyle(
        "CardRightBold",
        parent=styles["Normal"],
        fontName=bold_font,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#005DAC"),
        alignment=2,
    )
    caption_style = ParagraphStyle(
        "CardCaption",
        parent=styles["Normal"],
        fontName=bold_font,
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748B"),
    )

    story = []
    story.append(Paragraph("EvalDesk AI — Executive Academic Report Card", title_style))
    story.append(Spacer(1, 3))
    story.append(Paragraph(f"<b>Assessment:</b> {safe_xml(clean_title)}", subtitle_style))
    story.append(Spacer(1, 10))

    # Page-1 Executive KPI Summary Block
    qs = quality_stats or {}
    unresolved_cnt = qs.get("unresolved_flags", 0)
    resolved_cnt = qs.get("resolved_flags", 0)
    override_cnt = qs.get("overrides", 0)

    meta_rows = [
        [
            Paragraph(f"<b>Student Name:</b> {safe_xml(student_name or 'Anonymous')}", body_style),
            Paragraph(f"<b>Roll No:</b> {safe_xml(roll_number or 'N/A')}", body_style),
        ],
        [
            Paragraph(f"<b>Effective Total Score:</b> <font color='#005DAC'><b>{total_score:g} / {max_marks:g}</b></font>", body_style),
            Paragraph(f"<b>Evaluation Result:</b> <b>{percentage:g}% (Grade {safe_xml(grade)})</b>", body_style),
        ],
        [
            Paragraph(f"<b>Assessment Title:</b> {safe_xml(clean_title)}", body_style),
            Paragraph(f"<b>Quality Review:</b> {resolved_cnt} Resolved | {unresolved_cnt} Unresolved | {override_cnt} Overrides", body_style),
        ],
    ]
    meta_table = Table(meta_rows, colWidths=[270, 270])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # Group questions by section
    sec_groups: Dict[str, List[Dict[str, Any]]] = {}
    for q in questions:
        s_name = str(q.get("section_name") or "General").strip()
        sec_groups.setdefault(s_name, []).append(q)

    for sec_name, q_list in sec_groups.items():
        sec_counted_score = sum(float(q.get("final_marks", 0.0)) for q in q_list if q.get("is_counted", True))
        
        # Take section max marks from sections_meta if available
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
                Paragraph(f"<b>{safe_xml(sec_name)}</b>", sec_head_style),
                Paragraph(f"Section Subtotal: {sec_counted_score:g} / {sec_counted_max:g} Marks", sec_subtotal_style),
            ]
        ], colWidths=[350, 190])
        sec_banner.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#E2E8F0")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(KeepTogether([sec_banner, Spacer(1, 6)]))

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
                badge = "<font color='#575E71'><b>[Optional — Not Counted in Total]</b></font>"
                if is_att:
                    marks_str = f"{score:g} / {max_m:g} (Excluded)"
                else:
                    marks_str = f"0 / {max_m:g} (Excluded)"
            elif not is_att:
                badge = "<font color='#BA1A1A'><b>[Unattempted — 0 Marks]</b></font>"
                marks_str = f"0 / {max_m:g}"
            elif score >= max_m and max_m > 0:
                badge = "<font color='#196B22'><b>[Full Marks]</b></font>"
                marks_str = f"{score:g} / {max_m:g}"
            elif score > 0:
                badge = "<font color='#B26A00'><b>[Partial Marks]</b></font>"
                marks_str = f"{score:g} / {max_m:g}"
            else:
                badge = "<font color='#BA1A1A'><b>[0 Marks]</b></font>"
                marks_str = f"0 / {max_m:g}"

            card_rows = []

            # Top bar of question card
            top_bar = Table([
                [
                    Paragraph(f"<b>{safe_xml(format_q_number(q.get('q_no')))}</b>", bold_style),
                    Paragraph(badge, center_style),
                    Paragraph(f"<b>Marks: {marks_str}</b>", right_bold_style),
                ]
            ], colWidths=[140, 240, 140])
            top_bar.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EEF2F6" if is_counted else "#F1F5F9")),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
                ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ]))
            card_rows.append([top_bar])

            # Question text
            q_txt = str(q.get("question_text") or "").strip()
            if q_txt:
                card_rows.append([Paragraph(f"<b>Question:</b> {safe_xml(q_txt)}", body_style)])

            # Handwriting Crop Image
            crop_img = create_scaled_image(q.get("crop_image_path"))
            if crop_img:
                img_block = Table([
                    [Paragraph("<font color='#64748B' size='7.5'><b>Student Handwriting Submission (Cropped Region):</b></font>", caption_style)],
                    [crop_img]
                ], colWidths=[520])
                img_block.setStyle(TableStyle([
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('TOPPADDING', (0,0), (-1,-1), 2),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                    ('LEFTPADDING', (0,0), (-1,-1), 2),
                    ('RIGHTPADDING', (0,0), (-1,-1), 2),
                ]))
                card_rows.append([img_block])

            # Verbatim Transcript
            if raw_text:
                card_rows.append([Paragraph(f"<b>Verbatim Transcript:</b> <font color='#0F172A'>{safe_xml(raw_text)}</font>", body_style)])

            # Evidence Quote
            ev_quote = str(q.get("evidence_quote") or "").strip()
            if ev_quote and ev_quote not in ["—", "— (Not attempted)", "None"]:
                card_rows.append([Paragraph(f"<b>Verified Evidence:</b> <font color='#0F766E'><i>\"{safe_xml(ev_quote)}\"</i></font>", body_style)])

            # Concise Feedback
            clean_fb = format_concise_feedback(q.get("reason"), score, max_m, is_att, is_counted)
            card_rows.append([Paragraph(f"<b>Evaluation Feedback:</b> {safe_xml(clean_fb)}", body_style)])

            card_table = Table(card_rows, colWidths=[540])
            card_table.setStyle(TableStyle([
                ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1" if is_counted else "#E2E8F0")),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFFFFF" if is_counted else "#FAFAFA")),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
                ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(KeepTogether([card_table, Spacer(1, 8)]))

    # Strengths and Improvements (T7)
    strengths_content = [
        Paragraph("<b>Key Strengths (Mastered Rubric Criteria)</b>", ParagraphStyle("StrHead", parent=sec_head_style, textColor=colors.HexColor("#1B5E20"))),
        Spacer(1, 3),
    ]
    if strengths:
        for s in strengths:
            strengths_content.append(Paragraph(f"• {safe_xml(s)}", body_style))
    else:
        strengths_content.append(Paragraph("• Demonstrated clear conceptual understanding on attempted questions.", body_style))

    str_table = Table([[strengths_content]], colWidths=[540])
    str_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F8E9")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#C8E6C9")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(KeepTogether([str_table, Spacer(1, 8)]))

    imp_content = [
        Paragraph("<b>Areas for Improvement (Missed Rubric Criteria)</b>", ParagraphStyle("ImpHead", parent=sec_head_style, textColor=colors.HexColor("#B45309"))),
        Spacer(1, 3),
    ]
    if improvements:
        for imp in improvements:
            imp_content.append(Paragraph(f"• {safe_xml(imp)}", body_style))
    else:
        imp_content.append(Paragraph("• Strong performance across all attempted criteria; no major conceptual gaps identified.", body_style))

    imp_table = Table([[imp_content]], colWidths=[540])
    imp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFFBEB")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#FDE68A")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(KeepTogether([imp_table]))

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

