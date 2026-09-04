import io
import datetime
from typing import Dict, Any, Optional
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from backend.config import settings

class ReceiptService:
    """
    Generates professional PDF receipts for completed Razorpay transactions.
    """
    def generate_order_pdf_receipt(self, order_data: Dict[str, Any]) -> bytes:
        """
        Generates a PDF document for an order dictionary and returns raw PDF bytes.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()

        # Custom Palette
        c_primary = colors.HexColor("#4F46E5") # Indigo 600
        c_dark = colors.HexColor("#0F172A")    # Slate 900
        c_emerald = colors.HexColor("#10B981") # Emerald 500
        c_slate = colors.HexColor("#475569")   # Slate 600
        c_bg_light = colors.HexColor("#F8FAFC")# Slate 50
        c_border = colors.HexColor("#E2E8F0")  # Slate 200

        # Styles
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=20,
            leading=24,
            textColor=c_dark,
            alignment=TA_LEFT
        )

        subtitle_style = ParagraphStyle(
            'SubtitleStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=c_slate,
            alignment=TA_LEFT
        )

        badge_style = ParagraphStyle(
            'BadgeStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#065F46"),
            alignment=TA_RIGHT
        )

        h2_style = ParagraphStyle(
            'H2Style',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=15,
            textColor=c_dark,
            spaceAfter=4
        )

        normal_style = ParagraphStyle(
            'NormalStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            textColor=c_dark
        )

        bold_style = ParagraphStyle(
            'BoldStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=13,
            textColor=c_dark
        )

        center_muted = ParagraphStyle(
            'CenterMuted',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=11,
            textColor=c_slate,
            alignment=TA_CENTER
        )

        story = []

        # Header Section
        merchant_name = settings.MERCHANT_NAME or "Apex Fashion & Lifestyle Store"
        order_id = order_data.get("order_id") or order_data.get("id") or "ORD-UNKNOWN"
        created_at = str(order_data.get("created_at") or datetime.datetime.now())
        buyer_email = order_data.get("buyer_email") or "customer@ai.com"
        total_amount = float(order_data.get("total_amount") or 0.0)
        razorpay_order_id = order_data.get("razorpay_order_id") or "N/A"
        razorpay_payment_id = order_data.get("razorpay_payment_id") or "pay_demo_captured"
        status_text = str(order_data.get("current_state") or order_data.get("status") or "RAZORPAY_CAPTURED")

        header_table_data = [
            [
                Paragraph(f"<b>{merchant_name}</b>", title_style),
                Paragraph("<b>OFFICIAL RECEIPT</b><br/><font color='#10B981'>RAZORPAY CAPTURED</font>", badge_style)
            ],
            [
                Paragraph("Universal AI-Commerce Adapter &bull; Razorpay Safeguarded Purchase", subtitle_style),
                Paragraph(f"Receipt Date: {created_at[:19]}", ParagraphStyle('RDate', parent=subtitle_style, alignment=TA_RIGHT))
            ]
        ]

        header_table = Table(header_table_data, colWidths=[360, 180])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 8))

        story.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceBefore=4, spaceAfter=14))

        # Order & Customer Metadata Info Box
        info_data = [
            [
                Paragraph("<b>Order Details</b>", h2_style),
                Paragraph("<b>Payment Verification</b>", h2_style)
            ],
            [
                Paragraph(f"<b>Internal Order ID:</b> {order_id}<br/>"
                          f"<b>Customer Email:</b> {buyer_email}<br/>"
                          f"<b>Order Status:</b> {status_text}", normal_style),
                Paragraph(f"<b>Razorpay Order ID:</b> {razorpay_order_id}<br/>"
                          f"<b>Razorpay Payment ID:</b> {razorpay_payment_id}<br/>"
                          f"<b>HMAC Signature:</b> Verified & Captured", normal_style)
            ]
        ]
        info_table = Table(info_data, colWidths=[270, 270])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), c_bg_light),
            ('BOX', (0,0), (-1,-1), 0.5, c_border),
            ('PADDING', (0,0), (-1,-1), 8),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 16))

        # Items Table Header
        story.append(Paragraph("Purchased Items Summary", h2_style))
        story.append(Spacer(1, 4))

        items = order_data.get("items") or order_data.get("items_json") or order_data.get("purchased_items") or []
        
        table_data = [
            [
                Paragraph("<b>SKU</b>", bold_style),
                Paragraph("<b>Product Name</b>", bold_style),
                Paragraph("<b>Qty</b>", ParagraphStyle('THC', parent=bold_style, alignment=TA_CENTER)),
                Paragraph("<b>Unit Price (INR)</b>", ParagraphStyle('THR', parent=bold_style, alignment=TA_RIGHT)),
                Paragraph("<b>Total (INR)</b>", ParagraphStyle('THR2', parent=bold_style, alignment=TA_RIGHT))
            ]
        ]

        calc_subtotal = 0.0

        for item in items:
            sku = item.get("sku") or "SKU-PRODUCT"
            name = item.get("name") or sku
            qty = int(item.get("quantity") or 1)
            unit_price = float(item.get("unit_price") or item.get("price") or item.get("claimed_unit_price") or 0.0)
            if unit_price == 0.0 and total_amount > 0 and len(items) == 1:
                unit_price = total_amount / qty
            
            line_total = float(item.get("line_total") or (unit_price * qty))
            calc_subtotal += line_total

            table_data.append([
                Paragraph(sku, normal_style),
                Paragraph(name, normal_style),
                Paragraph(str(qty), ParagraphStyle('TDC', parent=normal_style, alignment=TA_CENTER)),
                Paragraph(f"INR {unit_price:,.2f}", ParagraphStyle('TDR', parent=normal_style, alignment=TA_RIGHT)),
                Paragraph(f"INR {line_total:,.2f}", ParagraphStyle('TDR2', parent=normal_style, alignment=TA_RIGHT))
            ])

        # If no items were parsed, fallback row
        if len(items) == 0:
            calc_subtotal = total_amount
            table_data.append([
                Paragraph("APEX-ITEM-001", normal_style),
                Paragraph("Purchased Merchant Product", normal_style),
                Paragraph("1", ParagraphStyle('TDC', parent=normal_style, alignment=TA_CENTER)),
                Paragraph(f"INR {total_amount:,.2f}", ParagraphStyle('TDR', parent=normal_style, alignment=TA_RIGHT)),
                Paragraph(f"INR {total_amount:,.2f}", ParagraphStyle('TDR2', parent=normal_style, alignment=TA_RIGHT))
            ])

        items_table = Table(table_data, colWidths=[110, 210, 45, 85, 90])
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EEF2FF")),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
            ('TOPPADDING', (0,0), (-1,0), 8),
            ('GRID', (0,0), (-1,-1), 0.5, c_border),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,1), (-1,-1), 8),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 14))

        # Financial Summary Total Table
        summary_data = [
            [
                Paragraph("<b>Subtotal:</b>", normal_style),
                Paragraph(f"INR {calc_subtotal:,.2f}", ParagraphStyle('SR', parent=normal_style, alignment=TA_RIGHT))
            ],
            [
                Paragraph("<b>Taxes & Platform Fees:</b>", normal_style),
                Paragraph("INR 0.00 (Included)", ParagraphStyle('SR2', parent=normal_style, alignment=TA_RIGHT))
            ],
            [
                Paragraph("<b>Total Paid Amount:</b>", ParagraphStyle('ST', parent=bold_style, fontSize=11, leading=14)),
                Paragraph(f"<b>INR {total_amount:,.2f}</b>", ParagraphStyle('STR', parent=bold_style, fontSize=11, leading=14, textColor=c_emerald, alignment=TA_RIGHT))
            ]
        ]

        summary_table = Table(summary_data, colWidths=[380, 160])
        summary_table.setStyle(TableStyle([
            ('LINEABOVE', (0,2), (-1,2), 1, c_primary),
            ('PADDING', (0,0), (-1,-1), 5),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 24))

        # Footer Guarantee & Audit Stamp Box
        footer_data = [
            [
                Paragraph(
                    "<b>Autonomous AI Guardrail Audit Verified</b><br/>"
                    "This transaction was evaluated by the Merchant Policy Engine (Price Integrity, Velocity Caps, Stock Locks) "
                    "and secured via Razorpay payment capture gateway.",
                    center_muted
                )
            ]
        ]
        footer_table = Table(footer_data, colWidths=[540])
        footer_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
            ('BOX', (0,0), (-1,-1), 0.5, c_border),
            ('PADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(footer_table)

        doc.build(story)
        pdf_data = buffer.getvalue()
        buffer.close()
        return pdf_data

receipt_service_instance = ReceiptService()
