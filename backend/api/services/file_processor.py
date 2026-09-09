import csv
import io
import logging
from typing import Dict, Any, List
from django.core.files.uploadedfile import UploadedFile

logger = logging.getLogger(__name__)

class FileAttachmentProcessor:
    """
    Processador de arquivos anexados no Catana Studio.
    Suporta extracao de tabelas SKU (CSV, XLSX), briefings (PDF, TXT) e metadados de imagens.
    """

    @classmethod
    def process_file(cls, file_obj: UploadedFile) -> Dict[str, Any]:
        file_name = getattr(file_obj, "name", "arquivo")
        content_type = getattr(file_obj, "content_type", "")
        extension = file_name.split(".")[-1].lower() if "." in file_name else ""
        file_size = getattr(file_obj, "size", 0)

        result = {
            "name": file_name,
            "extension": extension,
            "size": file_size,
            "type": "unknown",
            "extracted_text": "",
            "metadata": {},
        }

        try:
            if extension in ["csv"]:
                result["type"] = "spreadsheet"
                result["extracted_text"] = cls._extract_csv(file_obj)
            elif extension in ["xlsx", "xls"]:
                result["type"] = "spreadsheet"
                result["extracted_text"] = cls._extract_excel(file_obj)
            elif extension in ["pdf"]:
                result["type"] = "document"
                result["extracted_text"] = cls._extract_pdf(file_obj)
            elif extension in ["txt", "md", "json"]:
                result["type"] = "text"
                result["extracted_text"] = cls._extract_text(file_obj)
            elif extension in ["png", "jpg", "jpeg", "webp", "gif"]:
                result["type"] = "image"
                result["extracted_text"] = f"Arquivo de imagem: {file_name} ({file_size} bytes)."
            else:
                result["extracted_text"] = f"Arquivo {file_name} recebido ({file_size} bytes)."
        except Exception as exc:
            logger.warning(f"Erro ao processar arquivo {file_name}: {exc}")
            result["extracted_text"] = f"Nao foi possivel extrair o conteudo completo do arquivo {file_name}."

        return result

    @classmethod
    def _extract_csv(cls, file_obj) -> str:
        file_obj.seek(0)
        content = file_obj.read()
        if isinstance(content, bytes):
            text = content.decode("utf-8", errors="replace")
        else:
            text = str(content)

        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        if not rows:
            return "Planilha CSV vazia."

        header = rows[0]
        data_rows = rows[1:51] # Primeiras 50 linhas para contexto
        
        md_table = [
            "| " + " | ".join(header) + " |",
            "| " + " | ".join(["---"] * len(header)) + " |"
        ]
        for r in data_rows:
            # Garante que tenha o mesmo numero de colunas
            row_vals = [str(cell).strip() for cell in r]
            if len(row_vals) < len(header):
                row_vals.extend([""] * (len(header) - len(row_vals)))
            md_table.append("| " + " | ".join(row_vals[:len(header)]) + " |")

        total_rows = len(rows) - 1
        summary = f"Planilha CSV com {total_rows} linhas no total. Amostra dos dados:\n"
        return summary + "\n".join(md_table)

    @classmethod
    def _extract_excel(cls, file_obj) -> str:
        import openpyxl
        file_obj.seek(0)
        wb = openpyxl.load_workbook(file_obj, data_only=True)
        sheet = wb.active

        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            return "Planilha Excel vazia."

        header = [str(cell or "").strip() for cell in rows[0]]
        data_rows = rows[1:51]

        md_table = [
            "| " + " | ".join(header) + " |",
            "| " + " | ".join(["---"] * len(header)) + " |"
        ]
        for r in data_rows:
            row_vals = [str(cell if cell is not None else "").strip() for cell in r]
            if len(row_vals) < len(header):
                row_vals.extend([""] * (len(header) - len(row_vals)))
            md_table.append("| " + " | ".join(row_vals[:len(header)]) + " |")

        total_rows = len(rows) - 1
        summary = f"Planilha Excel ({sheet.title}) com {total_rows} linhas. Amostra:\n"
        return summary + "\n".join(md_table)

    @classmethod
    def _extract_pdf(cls, file_obj) -> str:
        import pypdf
        file_obj.seek(0)
        reader = pypdf.PdfReader(file_obj)
        num_pages = len(reader.pages)
        
        extracted = []
        for i in range(min(15, num_pages)):
            page_text = reader.pages[i].extract_text() or ""
            if page_text.strip():
                extracted.append(f"--- Pagina {i+1} ---\n{page_text.strip()}")

        text_content = "\n\n".join(extracted)
        return f"Documento PDF ({num_pages} paginas no total):\n\n{text_content[:6000]}"

    @classmethod
    def _extract_text(cls, file_obj) -> str:
        file_obj.seek(0)
        content = file_obj.read()
        if isinstance(content, bytes):
            return content.decode("utf-8", errors="replace")[:6000]
        return str(content)[:6000]
