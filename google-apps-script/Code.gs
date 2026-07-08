/**
 * Copier ce fichier dans l’éditeur Google Apps Script (remplacer doPost / doGet),
 * puis Déployer > Gérer les déploiements > Nouvelle version.
 *
 * Feuille Resultats (11 colonnes) :
 * ID_Resultat, ID_Programme, Sal_Aff, Sal_NonAff, NonSal_Aff, NonSal_NonAff,
 * Trav_Declares, Trav_NonDeclares, Mt_Reconnu, Mt_NonReconnu, Controleurs_participants
 */

function isHeaderRow_(row) {
  if (!row || !row.length) return false;
  var a = String(row[0] || "")
    .trim()
    .toLowerCase();
  return a === "id_resultat" || a === "id_programme" || a.indexOf("identifiant") !== -1;
}

function upsertByColumnA_(sheet, values, existingData, startRow) {
  var idFind = String(values[0] || "").trim();
  if (!idFind) return -1;
  for (var i = startRow; i < existingData.length; i++) {
    if (String(existingData[i][0] || "").trim() === idFind) {
      return i + 1;
    }
  }
  return -1;
}

function upsertResultats_(sheet, values, existingData, startRow) {
  var idRes = String(values[0] || "").trim();
  var idProg = String(values[1] || "").trim();
  var rowIndex = -1;

  if (idRes) {
    for (var i = startRow; i < existingData.length; i++) {
      if (String(existingData[i][0] || "").trim() === idRes) {
        rowIndex = i + 1;
        break;
      }
    }
  }
  if (rowIndex < 0 && idProg) {
    for (var j = existingData.length - 1; j >= startRow; j--) {
      if (String(existingData[j][1] || "").trim() === idProg) {
        rowIndex = j + 1;
        values[0] = existingData[j][0];
        break;
      }
    }
  }
  return rowIndex;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function readSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss ? ss.getSheetByName(name) : null;
}

function normalizeHeader_(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function buildHeaderIndex_(headerRow) {
  var idx = {};
  for (var i = 0; i < headerRow.length; i++) {
    var key = normalizeHeader_(headerRow[i]);
    if (!key) continue;
    if (idx[key] === undefined) idx[key] = i;
  }
  return idx;
}

function bytesToHex_(bytes) {
  var hex = [];
  for (var i = 0; i < bytes.length; i++) {
    var v = (bytes[i] + 256) % 256;
    var h = v.toString(16);
    hex.push(h.length === 1 ? "0" + h : h);
  }
  return hex.join("");
}

function sha256Hex_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ""), Utilities.Charset.UTF_8);
  return bytesToHex_(bytes);
}

function passwordHashHex_(matricule, pw) {
  return sha256Hex_(String(matricule || "").trim() + ":" + String(pw || ""));
}

function passwordHash_(matricule, pw) {
  return "sha256:" + passwordHashHex_(matricule, pw);
}

function isSha256Hex_(s) {
  return /^[0-9a-f]{64}$/i.test(String(s || "").trim());
}

function passwordMatches_(matricule, inputPw, storedPw) {
  var stored = String(storedPw || "").trim();
  if (!stored) return false;
  if (stored.indexOf("sha256:") === 0) {
    return passwordHash_(matricule, inputPw) === stored;
  }
  if (isSha256Hex_(stored)) {
    return passwordHashHex_(matricule, inputPw) === stored.toLowerCase();
  }
  return stored === String(inputPw || "").trim();
}

function sheetObjects_(sheet) {
  if (!sheet) return { headers: [], rows: [] };
  var data = sheet.getDataRange().getDisplayValues();
  if (!data || data.length < 2) return { headers: data && data.length ? data[0] : [], rows: [] };
  var headers = data[0];
  var index = buildHeaderIndex_(headers);
  var rows = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row || row.join("").trim() === "") continue;
    var obj = {};
    for (var k in index) obj[k] = row[index[k]];
    rows.push(obj);
  }
  return { headers: headers, rows: rows, index: index };
}

function findBureau_(codeBr) {
  var s = readSheet_("Bureaux");
  var pack = sheetObjects_(s);
  var code = String(codeBr || "").trim();
  if (!code) return null;
  for (var i = 0; i < pack.rows.length; i++) {
    var r = pack.rows[i];
    var c = String(r.code_bureau || r.code_br || r.code || r.bureau_code || "").trim();
    if (c === code) return r;
  }
  return null;
}

function createSession_(matricule, codeBr) {
  var token = Utilities.getUuid();
  var cache = CacheService.getScriptCache();
  cache.put(
    "sess:" + token,
    JSON.stringify({ matricule: String(matricule || "").trim(), codeBr: String(codeBr || "").trim() }),
    21600
  );
  return token;
}

function getSession_(token) {
  var t = String(token || "").trim();
  if (!t) return null;
  var cache = CacheService.getScriptCache();
  var raw = cache.get("sess:" + t);
  if (!raw) return null;
  try {
    var obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : null;
  } catch (e) {
    return null;
  }
}

function requireSession_(data) {
  var token = data ? data.token : "";
  var sess = getSession_(token);
  return sess;
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  if (data && data.action) {
    if (data.action === "login") {
      var matricule = String(data.matricule || "").trim();
      var pw = String(data.pw || "").trim();
      if (!matricule || !pw) return json_({ ok: false, error: "missing_credentials" });
      var usersSheet = readSheet_("Users");
      var usersPack = sheetObjects_(usersSheet);
      var found = null;
      for (var i = 0; i < usersPack.rows.length; i++) {
        var u = usersPack.rows[i];
        var m = String(u.matricule || "").trim();
        var p = String(u.pw || u.password || "").trim();
        if (m === matricule && passwordMatches_(matricule, pw, p)) {
          found = u;
          break;
        }
      }
      if (!found) return json_({ ok: false, error: "invalid_credentials" });
      var codeBr = String(found.code_br || found.code || found.bureau_code || "").trim();
      var bureau = codeBr ? findBureau_(codeBr) : null;
      var token = createSession_(matricule, codeBr);
      return json_({
        ok: true,
        token: token,
        user: {
          matricule: String(found.matricule || "").trim(),
          frName: String(found.fr_name || found.nom_fr || "").trim(),
          arName: String(found.ar_name || found.nom_ar || "").trim(),
          grade: String(found.grade || "").trim(),
          codeBr: codeBr,
          bureauName: bureau ? String(bureau.nom_bureau || "").trim() : "",
          bureauNameAr: bureau ? String(bureau.nom_bureau_ar || "").trim() : "",
          bureauRegion: bureau ? String(bureau.region || "").trim() : "",
          userType: String(found.user_type || "").trim()
        }
      });
    }

    if (data.action === "changePassword") {
      var sess0 = requireSession_(data);
      if (!sess0 || !sess0.matricule) return json_({ ok: false, error: "unauthorized" });
      var oldPw = String(data.oldPw || "").trim();
      var newPw = String(data.newPw || "").trim();
      if (!oldPw || !newPw) return json_({ ok: false, error: "missing_fields" });
      var usersSheet0 = readSheet_("Users");
      if (!usersSheet0) return json_({ ok: false, error: "missing_sheet" });
      var all0 = usersSheet0.getDataRange().getValues();
      if (!all0 || all0.length < 2) return json_({ ok: false, error: "empty_sheet" });
      var headers0 = all0[0];
      var idx0 = buildHeaderIndex_(headers0);
      var matriculeIdx = idx0.matricule !== undefined ? idx0.matricule : 0;
      var pwIdx =
        idx0.pw !== undefined ? idx0.pw : idx0.password !== undefined ? idx0.password : Math.min(1, headers0.length - 1);
      var rowToUpdate0 = -1;
      var stored0 = "";
      for (var r0 = 1; r0 < all0.length; r0++) {
        var row0 = all0[r0];
        if (!row0) continue;
        if (String(row0[matriculeIdx] || "").trim() === String(sess0.matricule || "").trim()) {
          rowToUpdate0 = r0 + 1;
          stored0 = String(row0[pwIdx] || "").trim();
          break;
        }
      }
      if (rowToUpdate0 < 0) return json_({ ok: false, error: "user_not_found" });
      if (!passwordMatches_(sess0.matricule, oldPw, stored0)) return json_({ ok: false, error: "invalid_old_password" });
      usersSheet0.getRange(rowToUpdate0, pwIdx + 1).setValue(passwordHash_(sess0.matricule, newPw));
      return json_({ ok: true });
    }

    if (data.action === "getAdminSheet") {
      var sessAdmin = requireSession_(data);
      if (!sessAdmin) return json_({ ok: false, error: "unauthorized" });
      var snameAdmin = String(data.sheet || "").trim();
      if (snameAdmin !== "Programmes" && snameAdmin !== "Resultats" && snameAdmin !== "Bureaux") return json_({ ok: false, error: "invalid_sheet" });
      var sheetAdmin = readSheet_(snameAdmin);
      if (!sheetAdmin) return json_({ ok: true, rows: [] });
      var allAdmin = sheetAdmin.getDataRange().getDisplayValues();
      var rowsAdmin = allAdmin && allAdmin.length > 1 ? allAdmin.slice(1) : [];
      return json_({ ok: true, rows: rowsAdmin });
    }

    if (data.action === "getSheet") {
      var sess = requireSession_(data);
      if (!sess || !sess.codeBr) return json_({ ok: false, error: "unauthorized" });
      var sname = String(data.sheet || "").trim();
      if (sname !== "Programmes" && sname !== "Resultats" && sname !== "Bureaux") return json_({ ok: false, error: "invalid_sheet" });
      if (sname === "Bureaux") {
        var sheetBureau = readSheet_("Bureaux");
        if (!sheetBureau) return json_({ ok: true, rows: [] });
        var allBureau = sheetBureau.getDataRange().getDisplayValues();
        var rowsBureau = allBureau && allBureau.length > 1 ? allBureau.slice(1) : [];
        return json_({ ok: true, rows: rowsBureau });
      }
      var sheet = readSheet_(sname);
      if (!sheet) return json_({ ok: true, rows: [] });
      var all = sheet.getDataRange().getDisplayValues();
      var rows = all && all.length > 1 ? all.slice(1) : [];
      var code = String(sess.codeBr || "").trim();
      if (sname === "Programmes") {
        rows = rows.filter(function (r) {
          return r && String(r[1] || "").trim() === code;
        });
      } else if (sname === "Resultats") {
        var programmesSheet = readSheet_("Programmes");
        var programmesAll = programmesSheet ? programmesSheet.getDataRange().getDisplayValues() : [];
        var programmesRows = programmesAll && programmesAll.length > 1 ? programmesAll.slice(1) : [];
        var programmeIds = {};
        for (var i = 0; i < programmesRows.length; i++) {
          var pr = programmesRows[i];
          if (!pr) continue;
          if (String(pr[1] || "").trim() !== code) continue;
          var pid = String(pr[0] || "").trim();
          if (pid) programmeIds[pid] = true;
        }
        rows = rows.filter(function (r) {
          if (!r) return false;
          var cbr = String(r[12] || "").trim();
          if (cbr === code) return true;
          if (cbr) return false;
          var pid2 = String(r[1] || "").trim();
          return Boolean(pid2 && programmeIds[pid2]);
        });
      }
      return json_({ ok: true, rows: rows });
    }

    return json_({ ok: false, error: "unknown_action" });
  }

  var sess2 = requireSession_(data);
  var sheetName = String(data.sheet || "").trim();
  if (sheetName === "Programmes" || sheetName === "Resultats") {
    if (!sess2 || !sess2.codeBr) {
      return ContentService.createTextOutput("Erreur: unauthorized").setMimeType(ContentService.MimeType.TEXT);
    }
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(data.sheet);

  if (!sheet) {
    return ContentService.createTextOutput("Erreur: Feuille non trouvée").setMimeType(
      ContentService.MimeType.TEXT
    );
  }

  var values = data.values;
  if (!values || !values.length) {
    return ContentService.createTextOutput("Erreur: values vide").setMimeType(ContentService.MimeType.TEXT);
  }

  if (sess2 && sess2.codeBr) {
    if (sheetName === "Programmes") {
      values[1] = String(sess2.codeBr).trim();
    } else if (sheetName === "Resultats") {
      while (values.length < 13) values.push("");
      values[12] = String(sess2.codeBr).trim();
    }
  }

  var lastRow = sheet.getLastRow();
  var numCols = Math.max(values.length, sheet.getLastColumn() || 1);
  var existingData = lastRow < 1 ? [] : sheet.getRange(1, 1, lastRow, numCols).getValues();
  var start = existingData.length && isHeaderRow_(existingData[0]) ? 1 : 0;

  var rowToUpdate =
    data.sheet === "Resultats"
      ? upsertResultats_(sheet, values, existingData, start)
      : upsertByColumnA_(sheet, values, existingData, start);

  if (rowToUpdate > 0) {
    sheet.getRange(rowToUpdate, 1, 1, values.length).setValues([values]);
    return ContentService.createTextOutput("Mis à jour").setMimeType(ContentService.MimeType.TEXT);
  }

  sheet.appendRow(values);
  return ContentService.createTextOutput("Ajouté").setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  var sheetName = e.parameter.sheet;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }
  var data = sheet.getDataRange().getDisplayValues();
  var rows = data.length > 1 ? data.slice(1) : [];
  return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
}
