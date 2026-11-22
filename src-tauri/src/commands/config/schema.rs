pub(crate) fn config_schema_json() -> &'static str {
    r##"{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Life Launcher config",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "groups", "buttons", "projects", "today", "inbox", "settings"],
  "properties": {
    "$schema": { "type": "string" },
    "version": { "const": 3 },
    "groups": {
      "type": "array",
      "description": "Sidebar group names. Empty groups can be kept here.",
      "items": { "type": "string", "minLength": 1 }
    },
    "overlayPages": {
      "type": "array",
      "description": "Optional custom pages for the Ctrl+K dictionary. Fixed pages are derived and not stored.",
      "items": { "$ref": "#/$defs/overlayPage" }
    },
    "dictionaryOrder": {
      "type": "array",
      "description": "Optional dictionary-only order of visible button ids. Sidebar order remains the buttons array order.",
      "items": { "type": "string", "minLength": 1 },
      "uniqueItems": true
    },
    "buttons": {
      "type": "array",
      "items": { "$ref": "#/$defs/button" }
    },
    "projects": {
      "type": "array",
      "items": { "$ref": "#/$defs/project" },
      "contains": {
        "type": "object",
        "required": ["weeklyFocus"],
        "properties": { "weeklyFocus": { "const": true } }
      },
      "minContains": 0,
      "maxContains": 3
    },
    "today": { "$ref": "#/$defs/today" },
    "inbox": {
      "type": "array",
      "items": { "$ref": "#/$defs/inboxItem" }
    },
    "sourceCompletions": {
      "type": "array",
      "items": { "$ref": "#/$defs/sourceCompletion" }
    },
    "settings": { "$ref": "#/$defs/settings" }
  },
  "$defs": {
    "overlayPage": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "name"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "name": { "type": "string", "minLength": 1, "maxLength": 24 }
      }
    },
    "button": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "label", "actions"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "label": { "type": "string", "minLength": 1 },
        "icon": { "type": ["string", "null"] },
        "iconSource": { "type": ["string", "null"], "description": "Local path used as the source for cached shell icon extraction." },
        "group": { "type": ["string", "null"], "description": "Sidebar group name. Empty or omitted goes to その他." },
        "showInSidebar": { "type": "boolean", "default": true, "description": "Whether the button appears in the left Quick sidebar." },
        "showInOverlay": { "type": "boolean", "default": true, "description": "Whether the button appears in the Ctrl+K dictionary overlay." },
        "overlayPageId": { "type": "string", "minLength": 1, "description": "Optional custom dictionary page id. Missing or unknown ids are shown as unclassified." },
        "aliases": {
          "type": "array",
          "description": "Search keywords for the Ctrl+K dictionary.",
          "items": { "type": "string", "minLength": 1 },
          "default": []
        },
        "description": { "type": ["string", "null"], "description": "Optional memo shown in button editing and searched by the Ctrl+K dictionary." },
        "actions": {
          "type": "array",
          "items": { "$ref": "#/$defs/action" }
        }
      }
    },
    "project": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "name"],
      "allOf": [
        { "not": { "required": ["nextStep", "legacyNextStepSettings"] } }
      ],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "name": { "type": "string", "minLength": 1 },
        "northStar": { "type": "string", "minLength": 1, "maxLength": 60 },
        "weeklyFocus": { "type": "boolean" },
        "nextStep": { "$ref": "#/$defs/nextStep" },
        "legacyNextStepSettings": { "$ref": "#/$defs/nextStepExecutionSettings" },
        "colorId": {
          "type": "string",
          "enum": [
            "amber",
            "blue",
            "green",
            "violet",
            "rose",
            "cyan",
            "orange",
            "slate",
            "lime",
            "magenta",
            "sand",
            "coral"
          ]
        }
      }
    },
    "nextStep": {
      "type": "object",
      "additionalProperties": false,
      "required": ["text"],
      "properties": {
        "text": { "type": "string" },
        "generationId": { "type": "string", "minLength": 1 },
        "sourceWishlistId": { "type": "string", "minLength": 1 },
        "trigger": { "type": "string", "minLength": 1, "maxLength": 40 },
        "updatedAt": { "type": "string", "format": "date-time" },
        "reviewedAt": { "type": "string", "format": "date-time" },
        "resumeNote": { "type": "string", "minLength": 1, "maxLength": 80 },
        "buttonIds": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "defaultTimerMinutes": { "type": "integer", "minimum": 1, "maximum": 240 },
        "shortTimerMinutes": { "type": "integer", "minimum": 1, "maximum": 240 },
        "expandTimerOnStart": { "type": "boolean" },
        "startNoteTemplate": { "type": "string" },
        "instructionPath": {
          "type": "string",
          "minLength": 3,
          "pattern": "^[A-Za-z]:[\\\\/]"
        },
        "instructionOpenOnStart": { "type": "boolean" }
      }
    },
    "nextStepExecutionSettings": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "buttonIds": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "defaultTimerMinutes": { "type": "integer", "minimum": 1, "maximum": 240 },
        "shortTimerMinutes": { "type": "integer", "minimum": 1, "maximum": 240 },
        "expandTimerOnStart": { "type": "boolean" },
        "startNoteTemplate": { "type": "string" },
        "instructionPath": {
          "type": "string",
          "minLength": 3,
          "pattern": "^[A-Za-z]:[\\\\/]"
        },
        "instructionOpenOnStart": { "type": "boolean" }
      }
    },
    "today": {
      "type": "object",
      "additionalProperties": false,
      "required": ["date", "items"],
      "properties": {
        "date": { "type": "string" },
        "victory": { "$ref": "#/$defs/todayVictory" },
        "items": {
          "type": "array",
          "maxItems": 3,
          "items": { "$ref": "#/$defs/todayItem" }
        },
        "candidateExcludedSourceKeys": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "uniqueItems": true
        },
        "selectionMutationTokens": {
          "type": "object",
          "additionalProperties": { "type": "string" }
        }
      }
    },
    "todayVictory": {
      "type": "object",
      "additionalProperties": false,
      "required": ["text", "done"],
      "properties": {
        "text": { "type": "string" },
        "done": { "type": "boolean" }
      }
    },
    "todayItem": {
      "type": "object",
      "additionalProperties": false,
      "required": ["text", "done"],
      "properties": {
        "text": { "type": "string" },
        "done": { "type": "boolean" },
        "sourceKey": { "type": "string", "minLength": 1 },
        "sourceGenerationId": { "type": "string", "minLength": 1 },
        "trigger": { "type": "string", "minLength": 1, "maxLength": 40 },
        "projectId": { "type": "string", "minLength": 1 },
        "buttonIds": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "instructionPath": {
          "type": "string",
          "minLength": 3,
          "pattern": "^[A-Za-z]:[\\\\/]"
        },
        "instructionOpenOnStart": { "type": "boolean" },
        "defaultTimerMinutes": { "type": "integer", "minimum": 1, "maximum": 240 },
        "shortTimerMinutes": { "type": "integer", "minimum": 1, "maximum": 240 }
      }
    },
    "inboxItem": {
      "type": "object",
      "additionalProperties": false,
      "required": ["text"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "text": { "type": "string" },
        "projectId": { "type": "string", "minLength": 1 },
        "buttonIds": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "instructionPath": {
          "type": "string",
          "minLength": 3,
          "pattern": "^[A-Za-z]:[\\\\/]"
        },
        "instructionOpenOnStart": { "type": "boolean" }
      }
    },
    "sourceCompletion": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "sourceType", "sourceIdentity", "textSnapshot", "completedAt"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "sourceType": { "type": "string", "minLength": 1 },
        "sourceIdentity": { "type": "string", "minLength": 1 },
        "textSnapshot": { "type": "string" },
        "projectId": { "type": "string", "minLength": 1 },
        "projectNameSnapshot": { "type": "string" },
        "completedAt": { "type": "string", "format": "date-time" }
      }
    },
    "settings": {
      "type": "object",
      "additionalProperties": false,
      "required": ["alwaysOnTop", "focusHotkey", "launcherHotkey", "miniHotkey", "autoStart", "defaultTimerMinutes", "shortTimerMinutes", "dayStartHour", "backupFolder", "backupKeep", "miniMode", "miniWindowPosition"],
      "properties": {
        "alwaysOnTop": { "type": "boolean" },
        "focusHotkey": { "type": ["string", "null"] },
        "launcherHotkey": { "type": ["string", "null"], "default": "Ctrl+K" },
        "miniHotkey": { "type": ["string", "null"], "default": null },
        "autoStart": { "type": "boolean", "default": false },
        "defaultTimerMinutes": { "type": "integer", "minimum": 1, "maximum": 240 },
        "shortTimerMinutes": { "type": "integer", "minimum": 1, "maximum": 240, "default": 5 },
        "dayStartHour": { "type": "integer", "minimum": 0, "maximum": 23, "default": 4 },
        "backupFolder": { "type": ["string", "null"], "default": null },
        "backupKeep": { "type": "integer", "minimum": 1, "default": 30 },
        "miniMode": { "type": "boolean", "default": true },
        "restartShortFirst": { "type": "boolean", "default": true },
        "mainDisplaySize": { "type": "string", "enum": ["standard", "large", "xlarge"], "default": "standard" },
        "instructionFolders": {
          "type": "array",
          "maxItems": 5,
          "uniqueItems": true,
          "items": {
            "type": "string",
            "minLength": 3,
            "pattern": "^[A-Za-z]:[\\\\/]"
          }
        },
        "instructionFolderIdentities": {
          "type": "array",
          "maxItems": 5,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["path", "identity"],
            "properties": {
              "path": {
                "type": "string",
                "minLength": 3,
                "pattern": "^[A-Za-z]:[\\\\/]"
              },
              "identity": {
                "type": "string",
                "pattern": "^(?:[0-9A-F]{8}:[0-9A-F]{16}|[0-9A-F]{16}:[0-9A-F]{32})$"
              }
            }
          }
        },
        "instructionHotkey": { "type": ["string", "null"], "default": null },
        "firstRunDoneAt": { "type": "string", "format": "date-time" },
        "miniWindowPosition": {
          "type": ["object", "null"],
          "default": null,
          "additionalProperties": false,
          "required": ["x", "y"],
          "properties": {
            "x": { "type": "integer" },
            "y": { "type": "integer" }
          }
        }
      }
    },
    "action": {
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "payload"],
          "properties": {
            "type": { "const": "open_app" },
            "payload": { "$ref": "#/$defs/pathArgsPayload" }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "payload"],
          "properties": {
            "type": { "const": "open_url" },
            "payload": {
              "type": "object",
              "additionalProperties": false,
              "required": ["url"],
              "properties": { "url": { "type": "string" } }
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "payload"],
          "properties": {
            "type": { "const": "open_folder" },
            "payload": { "$ref": "#/$defs/pathPayload" }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "payload"],
          "properties": {
            "type": { "const": "open_file" },
            "payload": { "$ref": "#/$defs/pathPayload" }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "payload"],
          "properties": {
            "type": { "const": "run_script" },
            "payload": { "$ref": "#/$defs/pathArgsPayload" }
          }
        }
      ]
    },
    "pathPayload": {
      "type": "object",
      "additionalProperties": false,
      "required": ["path"],
      "properties": { "path": { "type": "string" } }
    },
    "pathArgsPayload": {
      "type": "object",
      "additionalProperties": false,
      "required": ["path"],
      "properties": {
        "path": { "type": "string" },
        "args": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}"##
}
