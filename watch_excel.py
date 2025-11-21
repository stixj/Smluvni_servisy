import time
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from convert_excel import convert_excel_to_json


class ExcelChangeHandler(FileSystemEventHandler):
    """Watchdog handler that triggers JSON regeneration on Excel changes."""

    def __init__(self, excel_path: Path) -> None:
        super().__init__()
        self.excel_path = excel_path.resolve()

    def on_modified(self, event):
        if Path(event.src_path).resolve() == self.excel_path:
            print("Detected change in Excel file, regenerating data_output.json...")
            convert_excel_to_json()

    def on_created(self, event):
        if Path(event.src_path).resolve() == self.excel_path:
            print("Excel file created, generating data_output.json...")
            convert_excel_to_json()


def main():
    excel_file = Path("Smluvní servisy-AI.xlsx").resolve()
    if not excel_file.exists():
        print(f"Warning: Excel file '{excel_file}' does not exist yet. Waiting for creation...")

    event_handler = ExcelChangeHandler(excel_file)
    observer = Observer()
    observer.schedule(event_handler, path=str(excel_file.parent), recursive=False)
    observer.start()

    print(f"Watching '{excel_file}' for changes. Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()

    observer.join()


if __name__ == "__main__":
    main()


