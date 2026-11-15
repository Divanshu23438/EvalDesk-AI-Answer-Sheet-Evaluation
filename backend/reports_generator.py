import re
from pathlib import Path
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

def format_q_number(q_no: Any) -> str:
    """
    Strips any existing leading 'Q.', 'Q', 'q.', or repeated 'Q.Q.' prefixes
    before prepending clean 'Q.' so question numbers always render cleanly
    (e.g., 'Q.1 (A) (i)' rather than 'Q.Q.1 (A) (i)').
    """
    s = str(q_no or "").strip()
    s_clean = re.sub(r"^(?:[Qq]\.?\s*)+", "", s).strip()
    return f"Q.{s_clean}" if s_clean else ""

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
):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(output_path), pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#00325B"),
        alignment=1,
    )
    subtitle_style = ParagraphStyle(
        "SubTitleStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#43474E"),
        alignment=1,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#005DAC"),
        spaceAfter=5,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1A1C1E"),
    )
    bold_body = ParagraphStyle(
        "BoldBody",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1A1C1E"),
    )

    story = []
    story.append(Paragraph("EvalDesk AI — Academic Report Card", title_style))
    story.append(Spacer(1, 3))
    story.append(Paragraph(f"<b>Assessment:</b> {paper_title}", subtitle_style))
    story.append(Spacer(1, 12))

    # Student metadata table
    meta_data = [
        [Paragraph(f"<b>Student Name:</b> {student_name or 'Anonymous'}", body_style), Paragraph(f"<b>Roll No:</b> {roll_number or 'N/A'}", body_style)],
        [Paragraph(f"<b>Total Score:</b> {total_score:g} / {max_marks:g}", body_style), Paragraph(f"<b>Result:</b> {percentage:g}% ({grade})", body_style)],
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

    # Questions table
    story.append(Paragraph("Question-by-Question Rubric Evaluation", section_heading))
    q_table_data = [["Q #", "Marks Awarded", "Max Marks", "Status / Remarks", "Evidence Quote"]]
    for q in questions:
        is_unattempted = (
            q.get("attempted") is False
            or not q.get("is_attempted", True)
            or "not_attempted" in q.get("flags", [])
            or any("unattempted" in str(f).lower() or "not attempted" in str(f).lower() for f in q.get("flags", []))
            or str(q.get("reason", "")).lower() in ["question not attempted.", "not attempted", "unattempted"]
            or "not attempted" in str(q.get("status_label", "")).lower()
            or "unattempted" in str(q.get("status_label", "")).lower()
        )

        if is_unattempted:
            evidence_cell = Paragraph("— (Not attempted)", body_style)
        elif q.get("evidence_quote"):
            evidence_cell = Paragraph(f'"{q.get("evidence_quote")}"', body_style)
        else:
            evidence_cell = Paragraph("—", body_style)

        q_table_data.append([
            Paragraph(format_q_number(q.get("q_no", "")), bold_body),
            Paragraph(f"{q.get('final_marks', 0.0):g}", body_style),
            Paragraph(f"{q.get('max_marks', 0.0):g}", body_style),
            Paragraph(q.get("reason") or q.get("status_label", "Checked"), body_style),
            evidence_cell,
        ])

    q_table = Table(q_table_data, colWidths=[40, 80, 65, 185, 170])
    q_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#005DAC")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 5),
        ('TOPPADDING', (0,0), (-1,0), 5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#C3C7CF")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(q_table)
    story.append(Spacer(1, 12))

    # Strengths and Improvements (Task T7)
    story.append(Paragraph("Key Strengths (Task T7 Rubric Analysis)", section_heading))
    if strengths:
        for s in strengths:
            story.append(Paragraph(f"• {s}", body_style))
    else:
        story.append(Paragraph("• Demonstrated clear conceptual understanding on attempted questions.", body_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Areas for Improvement (Missed Rubric Criteria)", section_heading))
    if improvements:
        for imp in improvements:
            story.append(Paragraph(f"• {imp}", body_style))
    else:
        story.append(Paragraph("• Ensure all key technical definitions and step details are included.", body_style))

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
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(output_path), pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#00325B"),
        alignment=1,
    )
    subtitle_style = ParagraphStyle(
        "SubTitleStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#43474E"),
        alignment=1,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#005DAC"),
        spaceAfter=5,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1A1C1E"),
    )
    bold_body = ParagraphStyle(
        "BoldBody",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1A1C1E"),
    )

    story = []
    story.append(Paragraph("EvalDesk AI — Class Assessment Summary Report", title_style))
    story.append(Spacer(1, 3))
    story.append(Paragraph(f"<b>Exam:</b> {paper_title}", subtitle_style))
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
            Paragraph(format_q_number(q.get('q_no', '')), bold_body),
            Paragraph(f"{q.get('max_marks', 0.0):g}M", body_style),
            Paragraph(f"{q.get('avg_marks', 0.0):g}M", body_style),
            Paragraph(f"{q.get('accuracy_pct', 0.0):g}%", body_style),
            Paragraph(f"{q.get('miss_count', 0)} missed ({q.get('override_count', 0)} overrides)", body_style),
        ])

    q_table = Table(q_table_data, colWidths=[50, 75, 75, 80, 260])
    q_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#005DAC")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
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
            story.append(Paragraph(f"• {pt}", body_style))
    else:
        story.append(Paragraph("• No prevalent key-point deficits identified across student submissions.", body_style))
    story.append(Spacer(1, 10))

    # Recommendations
    story.append(Paragraph("Suggestions to Improve Future Question Papers", section_heading))
    if suggestions:
        for s in suggestions:
            story.append(Paragraph(f"• {s}", body_style))
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

    # --- Sheet 1: Class Results ---
    ws1 = wb.active
    ws1.title = "Class Results"

    header_font = Font(bold=True, color="FFFFFF", size=10)
    header_fill = PatternFill(start_color="005DAC", end_color="005DAC", fill_type="solid")
    align_center = Alignment(horizontal="center", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")

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
            row.append(q_scores.get(q.get("q_no"), 0.0))
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
        ("Assessment Title", paper_title),
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
