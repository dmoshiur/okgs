import { fieldsFor } from "./content-config";
import { checkImageUrl } from "./image-url";

export type ClubImageSaveMode = "create" | "update";

export interface PreparedClubImagePayload {
  payload: Record<string, any>;
  warnings: Record<string, string>;
}

/**
 * Club images are optional. A malformed pasted URL should not make the rest of
 * a club create/update fail: on create, omit that optional image; on update,
 * leave the previously saved image untouched. Valid values are canonicalised
 * before reaching the API or database.
 */
export function prepareClubImagePayload(
  source: Record<string, any>,
  mode: ClubImageSaveMode,
): PreparedClubImagePayload {
  const payload = { ...source };
  const warnings: Record<string, string> = {};

  for (const field of fieldsFor("clubs").filter((candidate) => candidate.type === "image")) {
    if (!(field.name in payload)) continue;

    const value = String(payload[field.name] ?? "").trim();
    if (!value) {
      payload[field.name] = "";
      continue;
    }

    const checked = checkImageUrl(value);
    if (checked.valid) {
      payload[field.name] = checked.value;
      continue;
    }

    if (mode === "create") {
      payload[field.name] = "";
      warnings[field.name] = `Invalid image link. This optional image was left blank. ${checked.message}`;
    } else {
      delete payload[field.name];
      warnings[field.name] = `Invalid image link. The saved image was left unchanged. ${checked.message}`;
    }
  }

  return { payload, warnings };
}
