from apps.core.models import FolioCounter

def generate_folio(document_type: str) -> str:
    """
    Genera un folio A?nico y secuencial para el tipo de documento dado.
    Ejemplo: generate_folio('TKT') -> 'TKT-2024-0001'
    Es segura para uso concurrente gracias a select_for_update().
    """
    return FolioCounter.get_next_folio(document_type)
