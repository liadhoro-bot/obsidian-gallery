#!/usr/bin/env python3
"""Generate paint swatch CSV and PNG ZIP assets for Supabase imports."""

from __future__ import annotations

import argparse
import csv
import html.parser
import mimetypes
import re
import sys
import urllib.parse
import urllib.request
import uuid
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover - exercised by users without deps
    fitz = None

try:
    from PIL import Image, ImageChops, ImageStat
except ImportError:  # pragma: no cover - exercised by users without deps
    Image = None
    ImageChops = None
    ImageStat = None

try:
    import yaml
except ImportError:  # pragma: no cover - exercised by users without deps
    yaml = None


CSV_COLUMNS = [
    "id",
    "brand",
    "line",
    "name",
    "sku",
    "swatch_image_url",
    "hex_approx",
    "finish",
    "paint_type",
    "is_active",
    "created_at",
]
STORAGE_URL_TEMPLATE = (
    "https://ckzrvjisesooqcmmtvwl.supabase.co/storage/v1/object/public/"
    "paint-swatches/{brand_slug}/{line_slug}/{filename}.png"
)


@dataclass(frozen=True)
class Rect:
    x0: int
    y0: int
    x1: int
    y1: int

    @property
    def width(self) -> int:
        return max(0, self.x1 - self.x0)

    @property
    def height(self) -> int:
        return max(0, self.y1 - self.y0)

    @property
    def area(self) -> int:
        return self.width * self.height

    @property
    def aspect(self) -> float:
        return self.width / self.height if self.height else 0

    @property
    def center(self) -> tuple[float, float]:
        return ((self.x0 + self.x1) / 2, (self.y0 + self.y1) / 2)

    def intersects(self, other: "Rect") -> bool:
        return self.x0 < other.x1 and self.x1 > other.x0 and self.y0 < other.y1 and self.y1 > other.y0

    def square_inside(self, padding: int = 0) -> "Rect":
        x0 = self.x0 + padding
        y0 = self.y0 + padding
        x1 = self.x1 - padding
        y1 = self.y1 - padding
        size = max(1, min(x1 - x0, y1 - y0))
        cx, cy = ((x0 + x1) / 2, (y0 + y1) / 2)
        half = size / 2
        return Rect(round(cx - half), round(cy - half), round(cx + half), round(cy + half))


@dataclass
class SwatchCandidate:
    image: Image.Image
    hex_approx: str
    page_number: int | None = None
    source_rect: Rect | None = None
    label: str = ""
    line: str = ""
    sku: str = ""
    rejected_reason: str = ""


@dataclass
class PaintRecord:
    id: str
    brand: str
    line: str
    name: str
    sku: str
    swatch_image_url: str
    hex_approx: str
    finish: str
    paint_type: str
    is_active: str
    created_at: str
    filename: str


@dataclass
class LineConfig:
    name: str
    keywords: list[str] = field(default_factory=list)
    sku_regex: str = r"\b[A-Z]{2,}[- ]?\d{2,5}\b"
    name_regex: str = ""
    finish: str = ""
    paint_type: str = ""
    expected_swatch_width: int = 0
    expected_swatch_height: int = 0
    min_container_width: int = 18
    min_container_height: int = 18
    max_container_width: int = 260
    max_container_height: int = 260
    crop_padding: int = 2


@dataclass
class ExtractionConfig:
    brand: str = ""
    adapter: str = "generic"
    render_zoom: float = 2.0
    min_saturation: int = 22
    max_background_luma: int = 246
    min_color_variance: float = 2.0
    max_aspect_ratio_delta: float = 0.9
    label_search_px: int = 220
    text_reject_padding_px: int = 3
    lines: dict[str, LineConfig] = field(default_factory=dict)


class ImageCollector(html.parser.HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__()
        self.base_url = base_url
        self.images: list[tuple[str, str]] = []
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {key.lower(): value or "" for key, value in attrs}
        if tag.lower() == "title":
            self._in_title = True
        if tag.lower() == "img" and attrs_dict.get("src"):
            url = urllib.parse.urljoin(self.base_url, attrs_dict["src"])
            label = attrs_dict.get("alt") or Path(urllib.parse.urlparse(url).path).stem
            self.images.append((url, label))

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data.strip()


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return re.sub(r"-+", "-", value).strip("-") or "unknown"


def ensure_dependencies() -> None:
    missing = []
    if fitz is None:
        missing.append("PyMuPDF")
    if Image is None:
        missing.append("Pillow")
    if yaml is None:
        missing.append("PyYAML")
    if missing:
        joined = ", ".join(missing)
        raise SystemExit(f"Missing Python dependencies: {joined}. Install them before running extraction.")


def load_config(path: Path | None, brand: str, cli_lines: list[str]) -> ExtractionConfig:
    data: dict[str, Any] = {}
    if path and path.exists():
        with path.open("r", encoding="utf-8") as handle:
            data = yaml.safe_load(handle) or {}

    line_configs: dict[str, LineConfig] = {}
    for raw_line in data.get("lines", []):
        line = LineConfig(**raw_line)
        line_configs[line.name] = line

    for line_name in cli_lines:
        if line_name not in line_configs:
            line_configs[line_name] = LineConfig(name=line_name)

    return ExtractionConfig(
        brand=data.get("brand", brand),
        adapter=data.get("adapter", "generic"),
        render_zoom=float(data.get("render_zoom", 2.0)),
        min_saturation=int(data.get("min_saturation", 22)),
        max_background_luma=int(data.get("max_background_luma", 246)),
        min_color_variance=float(data.get("min_color_variance", 2.0)),
        max_aspect_ratio_delta=float(data.get("max_aspect_ratio_delta", 0.9)),
        label_search_px=int(data.get("label_search_px", 220)),
        text_reject_padding_px=int(data.get("text_reject_padding_px", 3)),
        lines=line_configs,
    )


def default_config_path(brand: str) -> Path:
    return Path("configs") / f"{slugify(brand).replace('-', '_')}.yaml"


def split_lines(value: str | None, fallback: str | None) -> list[str]:
    raw = value or fallback or ""
    return [item.strip() for item in raw.split(",") if item.strip()]


def dominant_hex(image: Image.Image) -> str:
    thumb = image.convert("RGB").resize((1, 1), Image.Resampling.BILINEAR)
    r, g, b = thumb.getpixel((0, 0))
    return f"#{r:02X}{g:02X}{b:02X}"


def luma(rgb: tuple[int, int, int]) -> float:
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def saturation(rgb: tuple[int, int, int]) -> int:
    return max(rgb) - min(rgb)


def crop_image(image: Image.Image, rect: Rect) -> Image.Image:
    bounded = Rect(
        max(0, rect.x0),
        max(0, rect.y0),
        min(image.width, rect.x1),
        min(image.height, rect.y1),
    )
    return image.crop((bounded.x0, bounded.y0, bounded.x1, bounded.y1))


def resize_swatch(image: Image.Image) -> Image.Image:
    return image.convert("RGB").resize((256, 256), Image.Resampling.LANCZOS)


def image_variance(image: Image.Image) -> float:
    stat = ImageStat.Stat(image.convert("RGB"))
    return sum(stat.var) / len(stat.var)


def is_valid_color_crop(image: Image.Image, config: ExtractionConfig) -> tuple[bool, str]:
    stat = ImageStat.Stat(image.convert("RGB"))
    avg = tuple(round(value) for value in stat.mean[:3])
    if luma(avg) > config.max_background_luma and saturation(avg) < config.min_saturation:
        return False, "crop looks like page background"
    if image_variance(image) < config.min_color_variance and luma(avg) > config.max_background_luma:
        return False, "crop has too little color information"
    return True, ""


def find_color_containers(image: Image.Image, line_config: LineConfig, config: ExtractionConfig) -> list[Rect]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    mask: set[tuple[int, int]] = set()

    step = 2
    for y in range(0, height, step):
        for x in range(0, width, step):
            color = pixels[x, y]
            if saturation(color) >= config.min_saturation and luma(color) <= config.max_background_luma:
                mask.add((x // step, y // step))

    seen: set[tuple[int, int]] = set()
    rects: list[Rect] = []
    for point in list(mask):
        if point in seen:
            continue
        stack = [point]
        seen.add(point)
        min_x = max_x = point[0]
        min_y = max_y = point[1]
        count = 0
        while stack:
            px, py = stack.pop()
            count += 1
            min_x = min(min_x, px)
            max_x = max(max_x, px)
            min_y = min(min_y, py)
            max_y = max(max_y, py)
            for neighbor in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                if neighbor in mask and neighbor not in seen:
                    seen.add(neighbor)
                    stack.append(neighbor)
        if count < 40:
            continue
        rect = Rect(min_x * step, min_y * step, (max_x + 1) * step, (max_y + 1) * step)
        if not (
            line_config.min_container_width <= rect.width <= line_config.max_container_width
            and line_config.min_container_height <= rect.height <= line_config.max_container_height
        ):
            continue
        if abs(rect.aspect - 1) > config.max_aspect_ratio_delta:
            continue
        rects.append(rect)

    rects.sort(key=lambda item: (item.y0, item.x0))
    return merge_nearby_rects(rects)


def merge_nearby_rects(rects: list[Rect]) -> list[Rect]:
    merged: list[Rect] = []
    for rect in rects:
        match_index = None
        for index, current in enumerate(merged):
            close = abs(rect.x0 - current.x0) <= 4 and abs(rect.y0 - current.y0) <= 4
            overlaps = rect.intersects(current)
            if close or overlaps:
                match_index = index
                break
        if match_index is None:
            merged.append(rect)
        else:
            current = merged[match_index]
            merged[match_index] = Rect(
                min(current.x0, rect.x0),
                min(current.y0, rect.y0),
                max(current.x1, rect.x1),
                max(current.y1, rect.y1),
            )
    return merged


def pixmap_to_image(pixmap: Any) -> Image.Image:
    mode = "RGBA" if pixmap.alpha else "RGB"
    return Image.frombytes(mode, [pixmap.width, pixmap.height], pixmap.samples).convert("RGB")


def scaled_word_rect(word: tuple[Any, ...], zoom: float) -> Rect:
    return Rect(
        round(float(word[0]) * zoom),
        round(float(word[1]) * zoom),
        round(float(word[2]) * zoom),
        round(float(word[3]) * zoom),
    )


def expanded(rect: Rect, padding: int) -> Rect:
    return Rect(rect.x0 - padding, rect.y0 - padding, rect.x1 + padding, rect.y1 + padding)


def text_near_rect(words: list[tuple[Any, ...]], rect: Rect, zoom: float, search_px: int) -> str:
    nearby: list[tuple[int, int, str]] = []
    x0 = rect.x1
    x1 = rect.x1 + search_px
    y0 = rect.y0 - search_px // 3
    y1 = rect.y1 + search_px
    for word in words:
        word_rect = scaled_word_rect(word, zoom)
        if word_rect.x0 >= x0 and word_rect.x1 <= x1 and word_rect.y0 >= y0 and word_rect.y1 <= y1:
            nearby.append((word_rect.y0, word_rect.x0, str(word[4])))
        elif word_rect.y0 >= rect.y1 and word_rect.y0 <= y1 and abs(word_rect.x0 - rect.x0) <= search_px:
            nearby.append((word_rect.y0, word_rect.x0, str(word[4])))
    nearby.sort()
    return " ".join(item[2] for item in nearby[:12]).strip()


def parse_label(label: str, line_config: LineConfig) -> tuple[str, str]:
    sku = ""
    name = label.strip()
    sku_match = re.search(line_config.sku_regex, label, flags=re.IGNORECASE)
    if sku_match:
        sku = sku_match.group(0).replace(" ", "-").upper()
        name = (label[: sku_match.start()] + label[sku_match.end() :]).strip(" -:\t")
    if line_config.name_regex:
        name_match = re.search(line_config.name_regex, label, flags=re.IGNORECASE)
        if name_match:
            name = name_match.groupdict().get("name") or name_match.group(1)
    return name or sku or "Unnamed Paint", sku


def guess_line(label: str, requested_lines: list[str], config: ExtractionConfig) -> str:
    haystack = label.lower()
    for line_name, line_config in config.lines.items():
        names = [line_name, *line_config.keywords]
        if any(item.lower() in haystack for item in names if item):
            return line_name
    return requested_lines[0] if requested_lines else next(iter(config.lines), "Unknown Line")


class BrandAdapter:
    def __init__(self, brand: str, lines: list[str], config: ExtractionConfig) -> None:
        self.brand = brand
        self.lines = lines
        self.config = config

    def extract_from_pdf(self, source: Path) -> list[SwatchCandidate]:
        doc = fitz.open(source)
        candidates: list[SwatchCandidate] = []
        zoom = self.config.render_zoom
        matrix = fitz.Matrix(zoom, zoom)
        for page_index, page in enumerate(doc):
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            page_image = pixmap_to_image(pixmap)
            words = page.get_text("words")
            line_config = self._line_config_for_page(page.get_text("text"))
            for container in find_color_containers(page_image, line_config, self.config):
                candidate = self._candidate_from_container(page_image, words, container, page_index + 1, line_config)
                if candidate.rejected_reason:
                    continue
                candidates.append(candidate)
        return candidates

    def extract_from_image(self, source: Path, label: str = "") -> list[SwatchCandidate]:
        image = Image.open(source).convert("RGB")
        line_name = self.lines[0] if self.lines else next(iter(self.config.lines), "Unknown Line")
        line_config = self.config.lines.get(line_name, LineConfig(name=line_name))
        containers = find_color_containers(image, line_config, self.config)
        if not containers:
            square = self._largest_center_square(Rect(0, 0, image.width, image.height))
            crop = resize_swatch(crop_image(image, square))
            valid, reason = is_valid_color_crop(crop, self.config)
            name, sku = parse_label(label or source.stem, line_config)
            if not valid:
                return [
                    SwatchCandidate(
                        crop,
                        dominant_hex(crop),
                        label=label or name,
                        line=line_name,
                        sku=sku,
                        rejected_reason=reason,
                    )
                ]
            return [SwatchCandidate(crop, dominant_hex(crop), label=label or name, line=line_name, sku=sku)]
        candidates = []
        for rect in containers:
            crop = resize_swatch(crop_image(image, rect.square_inside(line_config.crop_padding)))
            valid, reason = is_valid_color_crop(crop, self.config)
            name, sku = parse_label(label or source.stem, line_config)
            candidates.append(
                SwatchCandidate(
                    crop,
                    dominant_hex(crop),
                    source_rect=rect,
                    label=label or source.stem,
                    line=line_name,
                    sku=sku,
                    rejected_reason=reason if not valid else "",
                )
            )
        return [item for item in candidates if not item.rejected_reason]

    def extract_from_url(self, url: str, scratch_dir: Path) -> list[SwatchCandidate]:
        response = fetch_url(url)
        content_type = response["content_type"]
        body = response["body"]
        suffix = suffix_from_content_type(content_type, url)
        if suffix == ".pdf":
            pdf_path = scratch_dir / "source.pdf"
            pdf_path.write_bytes(body)
            return self.extract_from_pdf(pdf_path)
        if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
            image_path = scratch_dir / f"source{suffix}"
            image_path.write_bytes(body)
            return self.extract_from_image(image_path, Path(urllib.parse.urlparse(url).path).stem)

        parser = ImageCollector(url)
        parser.feed(body.decode("utf-8", errors="ignore"))
        candidates: list[SwatchCandidate] = []
        for index, (image_url, label) in enumerate(parser.images):
            try:
                image_response = fetch_url(image_url)
            except OSError:
                continue
            image_suffix = suffix_from_content_type(image_response["content_type"], image_url)
            if image_suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
                continue
            image_path = scratch_dir / f"image-{index}{image_suffix}"
            image_path.write_bytes(image_response["body"])
            candidates.extend(self.extract_from_image(image_path, label))
        return candidates

    def _line_config_for_page(self, page_text: str) -> LineConfig:
        line_name = guess_line(page_text, self.lines, self.config)
        return self.config.lines.get(line_name, LineConfig(name=line_name))

    def _candidate_from_container(
        self,
        page_image: Image.Image,
        words: list[tuple[Any, ...]],
        container: Rect,
        page_number: int,
        line_config: LineConfig,
    ) -> SwatchCandidate:
        crop_rect = container.square_inside(line_config.crop_padding)
        for word in words:
            if crop_rect.intersects(expanded(scaled_word_rect(word, self.config.render_zoom), self.config.text_reject_padding_px)):
                return SwatchCandidate(page_image, "", page_number, container, rejected_reason="crop contains label text")
        crop = resize_swatch(crop_image(page_image, crop_rect))
        valid, reason = is_valid_color_crop(crop, self.config)
        label = text_near_rect(words, container, self.config.render_zoom, self.config.label_search_px)
        line = guess_line(label, self.lines, self.config) if label else line_config.name
        active_line_config = self.config.lines.get(line, line_config)
        name, sku = parse_label(label, active_line_config)
        return SwatchCandidate(
            image=crop,
            hex_approx=dominant_hex(crop),
            page_number=page_number,
            source_rect=container,
            label=label,
            line=line,
            sku=sku,
            rejected_reason=reason,
        )

    @staticmethod
    def _largest_center_square(rect: Rect) -> Rect:
        return rect.square_inside(0)


class GreenStuffWorldAdapter(BrandAdapter):
    """Green Stuff World catalogs often have colored boxes near dense labels."""

    def _candidate_from_container(
        self,
        page_image: Image.Image,
        words: list[tuple[Any, ...]],
        container: Rect,
        page_number: int,
        line_config: LineConfig,
    ) -> SwatchCandidate:
        snapped = self._snap_to_detected_container(container, find_color_containers(page_image, line_config, self.config))
        candidate = super()._candidate_from_container(page_image, words, snapped, page_number, line_config)
        if candidate.rejected_reason:
            return candidate
        if not (0.55 <= snapped.aspect <= 1.8):
            candidate.rejected_reason = "invalid swatch container aspect ratio"
            return candidate
        if self._looks_like_neighboring_swatches(candidate.image):
            candidate.rejected_reason = "crop appears to include neighboring swatches"
        return candidate

    @staticmethod
    def _snap_to_detected_container(expected: Rect, detected: list[Rect]) -> Rect:
        if not detected:
            return expected
        cx, cy = expected.center
        return min(detected, key=lambda rect: (rect.center[0] - cx) ** 2 + (rect.center[1] - cy) ** 2)

    @staticmethod
    def _looks_like_neighboring_swatches(image: Image.Image) -> bool:
        left = image.crop((0, 0, image.width // 4, image.height))
        right = image.crop((image.width * 3 // 4, 0, image.width, image.height))
        diff = ImageChops.difference(left.resize((32, 32)), right.resize((32, 32)))
        return sum(ImageStat.Stat(diff).mean) > 150


def adapter_for(brand: str, lines: list[str], config: ExtractionConfig) -> BrandAdapter:
    if config.adapter == "green_stuff_world" or slugify(brand) == "green-stuff-world":
        return GreenStuffWorldAdapter(brand, lines, config)
    return BrandAdapter(brand, lines, config)


def fetch_url(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "obsidian-gallery-dataset-generator/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return {
            "body": response.read(),
            "content_type": response.headers.get("content-type", "").split(";")[0].lower(),
        }


def suffix_from_content_type(content_type: str, url: str) -> str:
    suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if suffix:
        return suffix
    guessed = mimetypes.guess_extension(content_type) or ""
    return ".jpg" if guessed == ".jpe" else guessed


def records_from_candidates(
    candidates: list[SwatchCandidate],
    brand: str,
    config: ExtractionConfig,
) -> list[tuple[PaintRecord, Image.Image]]:
    brand_slug = slugify(brand)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    records: list[tuple[PaintRecord, Image.Image]] = []
    for index, candidate in enumerate(candidates, start=1):
        if candidate.rejected_reason:
            continue
        line = candidate.line or next(iter(config.lines), "Unknown Line")
        line_config = config.lines.get(line, LineConfig(name=line))
        name, parsed_sku = parse_label(candidate.label, line_config)
        sku = candidate.sku or parsed_sku or f"AUTO-{index:04d}"
        paint_name = name if name != "Unnamed Paint" else f"{line} {sku}"
        filename = f"{slugify(sku)}_{slugify(paint_name)}.png"
        line_slug = slugify(line)
        record = PaintRecord(
            id=str(uuid.uuid4()),
            brand=brand,
            line=line,
            name=paint_name,
            sku=sku,
            swatch_image_url=STORAGE_URL_TEMPLATE.format(
                brand_slug=brand_slug,
                line_slug=line_slug,
                filename=filename.removesuffix(".png"),
            ),
            hex_approx=candidate.hex_approx,
            finish=line_config.finish,
            paint_type=line_config.paint_type,
            is_active="true",
            created_at=now,
            filename=filename,
        )
        records.append((record, candidate.image))
    return dedupe_records(records)


def dedupe_records(records: list[tuple[PaintRecord, Image.Image]]) -> list[tuple[PaintRecord, Image.Image]]:
    seen: set[tuple[str, str, str]] = set()
    output: list[tuple[PaintRecord, Image.Image]] = []
    for record, image in records:
        key = (record.brand.lower(), record.line.lower(), record.sku.lower())
        if key in seen:
            continue
        seen.add(key)
        output.append((record, image))
    return output


def write_outputs(records: list[tuple[PaintRecord, Image.Image]], output_dir: Path, brand: str) -> tuple[Path, Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    image_root = output_dir / "paint-swatches" / slugify(brand)
    image_root.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / f"{slugify(brand)}_paint_dataset.csv"
    zip_path = output_dir / f"{slugify(brand)}_paint_swatches.zip"

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for record, _image in records:
            writer.writerow({column: getattr(record, column) for column in CSV_COLUMNS})

    png_paths: list[Path] = []
    for record, image in records:
        line_dir = image_root / slugify(record.line)
        line_dir.mkdir(parents=True, exist_ok=True)
        png_path = line_dir / record.filename
        image.save(png_path, format="PNG")
        png_paths.append(png_path)

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for png_path in png_paths:
            archive.write(png_path, png_path.relative_to(image_root.parent))

    validate_csv(csv_path)
    validate_png_csv_match(csv_path, png_paths)
    return csv_path, zip_path, image_root


def validate_csv(csv_path: Path) -> None:
    with csv_path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != CSV_COLUMNS:
            raise ValueError(f"CSV columns mismatch. Expected {CSV_COLUMNS}, got {reader.fieldnames}")
        for row_number, row in enumerate(reader, start=2):
            for column in CSV_COLUMNS:
                if row.get(column) in (None, "") and column not in {"finish", "paint_type"}:
                    raise ValueError(f"CSV row {row_number} is missing {column}")
            uuid.UUID(row["id"])
            if not re.fullmatch(r"#[0-9A-Fa-f]{6}", row["hex_approx"]):
                raise ValueError(f"CSV row {row_number} has invalid hex_approx: {row['hex_approx']}")
            if row["is_active"] not in {"true", "false"}:
                raise ValueError(f"CSV row {row_number} has invalid is_active: {row['is_active']}")


def validate_png_csv_match(csv_path: Path, png_paths: list[Path]) -> None:
    png_names = {path.name for path in png_paths}
    with csv_path.open("r", newline="", encoding="utf-8") as handle:
        csv_names = {Path(urllib.parse.urlparse(row["swatch_image_url"]).path).name for row in csv.DictReader(handle)}
    missing_pngs = csv_names - png_names
    extra_pngs = png_names - csv_names
    if missing_pngs or extra_pngs:
        raise ValueError(f"PNG/CSV mismatch. Missing PNGs: {sorted(missing_pngs)} Extra PNGs: {sorted(extra_pngs)}")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Supabase-ready paint swatch CSV and PNG ZIP assets.")
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--source", help="Local PDF or image path.")
    source_group.add_argument("--url", help="Website, PDF, or image URL.")
    parser.add_argument("--brand", required=True, help="Paint brand name.")
    parser.add_argument("--lines", help="Comma-separated paint line names.")
    parser.add_argument("--line", help="Single paint line name.")
    parser.add_argument("--config", help="YAML extraction config. Defaults to configs/<brand_slug>.yaml when present.")
    parser.add_argument("--output", default="downloads", help="Output directory. Defaults to ./downloads.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    ensure_dependencies()
    lines = split_lines(args.lines, args.line)
    config_path = Path(args.config) if args.config else default_config_path(args.brand)
    config = load_config(config_path if config_path.exists() else None, args.brand, lines)
    adapter = adapter_for(args.brand, lines or list(config.lines), config)
    output_dir = Path(args.output)
    scratch_dir = output_dir / ".scratch"
    scratch_dir.mkdir(parents=True, exist_ok=True)

    if args.source:
        source = Path(args.source)
        if not source.exists():
            raise SystemExit(f"Source not found: {source}")
        suffix = source.suffix.lower()
        if suffix == ".pdf":
            candidates = adapter.extract_from_pdf(source)
        elif suffix in {".png", ".jpg", ".jpeg", ".webp"}:
            candidates = adapter.extract_from_image(source, source.stem)
        else:
            raise SystemExit(f"Unsupported source type: {source.suffix}")
    else:
        candidates = adapter.extract_from_url(args.url, scratch_dir)

    records = records_from_candidates(candidates, args.brand, config)
    if not records:
        rejected = [item.rejected_reason for item in candidates if item.rejected_reason]
        detail = f" Rejections: {', '.join(sorted(set(rejected)))}" if rejected else ""
        raise SystemExit(f"No valid paint swatches were extracted.{detail}")
    csv_path, zip_path, image_root = write_outputs(records, output_dir, args.brand)
    print(f"Wrote CSV: {csv_path}")
    print(f"Wrote ZIP: {zip_path}")
    print(f"Wrote PNG folders: {image_root}")
    print(f"Rows: {len(records)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
