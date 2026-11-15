from pathlib import Path
from typing import Dict, Any, List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

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
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0B1C30"),
        alignment=1,
    )
    subtitle_style = ParagraphStyle(
        "SubTitleStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#43474E"),
        alignment=1,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#005696"),
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#1A1C1E"),
    )

    story = []
    story.append(Paragraph("EvalDesk AI — Academic Report Card", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"<b>Exam:</b> {paper_title}", subtitle_style))
    story.append(Spacer(1, 14))

    # Student metadata table
    meta_data = [
        [Paragraph(f"<b>Student Name:</b> {student_name or 'Anonymous'}", body_style), Paragraph(f"<b>Roll No:</b> {roll_number or 'N/A'}", body_style)],
        [Paragraph(f"<b>Total Score:</b> {total_score} / {max_marks}", body_style), Paragraph(f"<b>Percentage:</b> {percentage}% ({grade})", body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[270, 270])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F0F4FA")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#D4E3FF")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D4E3FF")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # Questions table
    story.append(Paragraph("Question-by-Question Performance", section_heading))
    q_table_data = [["Q #", "Marks Awarded", "Max Marks", "Status / Reason"]]
    for q in questions:
        q_table_data.append([
            q.get("q_no", ""),
            str(q.get("final_marks", 0.0)),
            str(q.get("max_marks", 0.0)),
            q.get("status_label", "Checked"),
        ])

    q_table = Table(q_table_data, colWidths=[60, 110, 90, 280])
    q_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#005696")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#C3C7CF")),
    ]))
    story.append(q_table)
    story.append(Spacer(1, 14))

    # Strengths and Improvements
    story.append(Paragraph("Key Strengths", section_heading))
    if strengths:
        for s in strengths:
            story.append(Paragraph(f"• {s}", body_style))
    else:
        story.append(Paragraph("• Strong grasp of fundamental concepts and accurate terminology.", body_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Areas for Improvement", section_heading))
    if improvements:
        for imp in improvements:
            story.append(Paragraph(f"• {imp}", body_style))
    else:
        story.append(Paragraph("• Review step-by-step reasoning on descriptive technical questions.", body_style))

    doc.build(story)

def generate_paper_report_excel(
    output_path: Path,
    paper_title: str,
    students: List[Dict[str, Any]],
    questions: List[Dict[str, Any]],
):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Class Results"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="005696", end_color="005696", fill_type="solid")

    headers = ["Roll No", "Student Name", "Total Score", "Max Marks", "Percentage", "Grade"]
    for q in questions:
        headers.append(f"Q.{q.get('q_no', '')} ({q.get('max_marks', 0)}M)")

    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

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
        ws.append(row)

    wb.save(str(output_path))
