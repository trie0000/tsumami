# 05_Notes — データモデル（JSONスキーマ草案）

> Draft: JSON Schema 2020-12 相当の書き味。厳密なバリデーションより「AI引き継ぎで迷わない」ことを優先。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "tsumami-project.schema.json",
  "title": "Tsumami Project",
  "type": "object",
  "required": ["id", "title", "unit", "fabricSquareSize", "createdAt", "updatedAt", "palette", "flowers"],
  "properties": {
    "version": {"type": "integer", "minimum": 1},
    "id": {"type": "string"},
    "title": {"type": "string"},
    "unit": {"type": "string", "enum": ["mm"]},
    "fabricSquareSize": {"type": "number", "minimum": 5, "maximum": 60},
    "notes": {"type": "string"},
    "createdAt": {"type": "string"},
    "updatedAt": {"type": "string"},
    "palette": {
      "type": "array",
      "items": {"$ref": "#/definitions/Color"}
    },
    "flowers": {
      "type": "array",
      "items": {"$ref": "#/definitions/Flower"}
    }
  },
  "definitions": {
    "Color": {
      "type": "object",
      "required": ["id", "name", "hex"],
      "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "hex": {"type": "string"}
      }
    },
    "Vec2": {
      "type": "object",
      "required": ["x", "y"],
      "properties": {
        "x": {"type": "number"},
        "y": {"type": "number"}
      }
    },
    "Flower": {
      "type": "object",
      "required": ["id", "name", "position", "flowerDiameter", "rotation", "layers"],
      "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "position": {"$ref": "#/definitions/Vec2"},
        "flowerDiameter": {"type": "number", "minimum": 10, "maximum": 200},
        "rotation": {"type": "number"},
        "layers": {
          "type": "array",
          "items": {"$ref": "#/definitions/Layer"}
        }
      }
    },
    "Layer": {
      "type": "object",
      "required": [
        "id", "name", "order", "petalType", "petalCount",
        "radius", "scale", "widthScale", "offsetAngle",
        "colorId", "visible", "locked"
      ],
      "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "order": {"type": "integer", "minimum": 1},
        "petalType": {"type": "string", "enum": ["丸つまみ", "剣つまみ"]},
        "petalCount": {"type": "integer", "minimum": 5, "maximum": 24},
        "radius": {"type": "number", "minimum": 2, "maximum": 120},
        "scale": {"type": "number", "minimum": 0.3, "maximum": 3},
        "widthScale": {"type": "number", "minimum": 0.5, "maximum": 1.8},
        "offsetAngle": {"type": "number"},
        "colorId": {"type": "string"},
        "visible": {"type": "boolean"},
        "locked": {"type": "boolean"},
        "petalOverrides": {
          "type": "array",
          "items": {"$ref": "#/definitions/PetalOverride"}
        }
      }
    },
    "PetalOverride": {
      "type": "object",
      "required": ["index"],
      "properties": {
        "index": {"type": "integer", "minimum": 0},
        "colorId": {"type": "string"},
        "petalType": {"type": "string", "enum": ["丸つまみ", "剣つまみ"]}
      }
    }
  }
}
```

## 補足（互換・正規化）
- `petalType` は過去互換で `maru/ken` を受け取り、読み込み時に `丸つまみ/剣つまみ` に正規化する。
- `petalCount` は読み込み時に 5–24 に clamp。
