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

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
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
