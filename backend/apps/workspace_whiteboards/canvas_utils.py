"""Helpers for reading and updating whiteboard canvas documents."""

from __future__ import annotations

from typing import Any


def _elements_list(canvas_data: dict) -> list[dict[str, Any]]:
    if not isinstance(canvas_data, dict):
        return []
    if canvas_data.get('version') == 1:
        elements = canvas_data.get('elements')
        if isinstance(elements, list):
            return [e for e in elements if isinstance(e, dict)]
        return []
    # Legacy tldraw snapshots are no longer rendered; treat as empty.
    return []


def find_note_shape(canvas_data: dict, element_id: str) -> dict[str, Any] | None:
    for record in _elements_list(canvas_data):
        if record.get('id') == element_id and record.get('type') == 'note':
            return record
    return None


def note_text_from_shape(shape: dict[str, Any]) -> str:
    text = shape.get('text')
    if isinstance(text, str):
        return text.strip()
    return ''


def attach_ticket_to_shape(
    canvas_data: dict,
    element_id: str,
    *,
    ticket_id: int,
    ticket_ticket_id: str,
) -> dict:
    elements = _elements_list(canvas_data)
    if not elements:
        return canvas_data

    updated_elements = []
    found = False
    for record in elements:
        if record.get('id') == element_id and record.get('type') == 'note':
            updated_elements.append({
                **record,
                'ticketId': ticket_id,
                'ticketTicketId': ticket_ticket_id,
            })
            found = True
        else:
            updated_elements.append(record)

    if not found:
        return canvas_data

    return {
        **canvas_data,
        'version': 1,
        'elements': updated_elements,
        'camera': canvas_data.get('camera') or {'x': 0, 'y': 0, 'zoom': 1},
    }
