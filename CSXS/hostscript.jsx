function NGS_LyricMotion_parseJSON(text) {
    if (typeof JSON !== "undefined" && JSON.parse) {
        return JSON.parse(text);
    }
    return eval("(" + text + ")");
}

function NGS_LyricMotion_stringify(obj) {
    if (typeof JSON !== "undefined" && JSON.stringify) {
        return JSON.stringify(obj);
    }
    if (obj === null) return "null";
    if (typeof obj === "string") return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
    if (obj instanceof Array) {
        var arr = [];
        for (var i = 0; i < obj.length; i++) arr.push(NGS_LyricMotion_stringify(obj[i]));
        return "[" + arr.join(",") + "]";
    }
    var parts = [];
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) {
            parts.push('"' + k + '":' + NGS_LyricMotion_stringify(obj[k]));
        }
    }
    return "{" + parts.join(",") + "}";
}

function NGS_LyricMotion_getPresetFiles() {
    var folder = new Folder(Folder.userData.fsName + "/NGS_LyricMotion");
    return {
        folder: folder,
        target: new File(folder.fsName + "/presets.json"),
        temporary: new File(folder.fsName + "/presets.json.tmp"),
        backup: new File(folder.fsName + "/presets.json.bak")
    };
}

function NGS_LyricMotion_transportText(value) {
    return String(value).replace(/\\/g, "/");
}

function NGS_LyricMotion_readPresetStore() {
    var files = NGS_LyricMotion_getPresetFiles();
    var path = NGS_LyricMotion_transportText(files.target.fsName);
    if (!files.target.exists) {
        return { ok: true, exists: false, path: path, presets: {} };
    }

    files.target.encoding = "UTF-8";
    if (!files.target.open("r")) {
        return { ok: false, error: "プリセットファイルを開けません: " + path, path: path };
    }

    var raw = "";
    try {
        raw = files.target.read();
    } catch (eRead) {
        return { ok: false, error: "プリセットファイルを読み込めません: " + path + "\n" + NGS_LyricMotion_transportText(eRead), path: path };
    } finally {
        try { files.target.close(); } catch (eClose) {}
    }

    try {
        if (raw.length > 0 && raw.charCodeAt(0) === 0xFEFF) raw = raw.substring(1);
        var data = NGS_LyricMotion_parseJSON(raw);
        if (!data || data.schemaVersion !== 1 || !data.presets || typeof data.presets !== "object") {
            throw new Error("未対応のファイル形式です");
        }
        return { ok: true, exists: true, path: path, presets: data.presets };
    } catch (eParse) {
        return { ok: false, error: "プリセットファイルが壊れています: " + path + "\n" + NGS_LyricMotion_transportText(eParse), path: path };
    }
}

function NGS_LyricMotion_writePresetStore(presets) {
    var files = NGS_LyricMotion_getPresetFiles();
    var path = NGS_LyricMotion_transportText(files.target.fsName);

    if (!files.folder.exists && !files.folder.create()) {
        return { ok: false, error: "プリセット保存フォルダーを作成できません: " + NGS_LyricMotion_transportText(files.folder.fsName), path: path };
    }

    if (files.temporary.exists) {
        try { files.temporary.remove(); } catch (eOldTemp) {}
    }

    files.temporary.encoding = "UTF-8";
    files.temporary.lineFeed = "Unix";
    if (!files.temporary.open("w")) {
        return { ok: false, error: "プリセット一時ファイルを作成できません: " + NGS_LyricMotion_transportText(files.temporary.fsName), path: path };
    }

    try {
        files.temporary.write(NGS_LyricMotion_stringify({ schemaVersion: 1, presets: presets }));
    } catch (eWrite) {
        try { files.temporary.close(); } catch (eCloseTemp) {}
        try { files.temporary.remove(); } catch (eRemoveTemp) {}
        return { ok: false, error: "プリセットを保存できません: " + path + "\n" + NGS_LyricMotion_transportText(eWrite), path: path };
    }
    files.temporary.close();

    if (files.backup.exists) {
        try { files.backup.remove(); } catch (eOldBackup) {}
    }
    if (files.target.exists) {
        if (!files.target.copy(files.backup.fsName) || !files.target.remove()) {
            try { files.temporary.remove(); } catch (eRemoveFailedTemp) {}
            return { ok: false, error: "既存のプリセットファイルを置換できません: " + path, path: path };
        }
    }
    if (!files.temporary.rename("presets.json")) {
        if (files.backup.exists) files.backup.copy(path);
        try { files.temporary.remove(); } catch (eRenameTemp) {}
        return { ok: false, error: "プリセットファイルを確定できません: " + path, path: path };
    }
    if (files.backup.exists) {
        try { files.backup.remove(); } catch (eRemoveBackup) {}
    }

    return { ok: true, exists: true, path: path, presets: presets };
}

function NGS_LyricMotion_loadPresets() {
    return NGS_LyricMotion_stringify(NGS_LyricMotion_readPresetStore());
}

function NGS_LyricMotion_mutatePresets(payload) {
    try {
        var request = NGS_LyricMotion_parseJSON(payload);
        var current = NGS_LyricMotion_readPresetStore();
        if (!current.ok) return NGS_LyricMotion_stringify(current);

        var presets = current.presets || {};
        if (request.action === "migrate") {
            var legacyPresets = request.presets || {};
            for (var legacyName in legacyPresets) {
                if (legacyPresets.hasOwnProperty(legacyName) && !presets.hasOwnProperty(legacyName)) {
                    presets[legacyName] = legacyPresets[legacyName];
                }
            }
        } else if (request.action === "upsert") {
            var name = String(request.name || "").replace(/^\s+|\s+$/g, "");
            if (!name) return NGS_LyricMotion_stringify({ ok: false, error: "プリセット名が空です", path: current.path });
            presets[name] = request.settings;
        } else if (request.action === "delete") {
            if (presets.hasOwnProperty(request.name)) delete presets[request.name];
        } else {
            return NGS_LyricMotion_stringify({ ok: false, error: "不明なプリセット操作です", path: current.path });
        }

        return NGS_LyricMotion_stringify(NGS_LyricMotion_writePresetStore(presets));
    } catch (e) {
        return NGS_LyricMotion_stringify({ ok: false, error: "プリセット操作に失敗しました: " + NGS_LyricMotion_transportText(e) });
    }
}

function NGS_LyricMotion_num(value, fallback) {
    var n = parseFloat(value);
    return isNaN(n) ? fallback : n;
}

function NGS_LyricMotion_bezToEase(p1, p2, diff, dur) {
    if (Math.abs(diff) < 0.0001) diff = diff >= 0 ? 0.0001 : -0.0001;
    if (dur === 0) dur = 0.001;

    // オーバーシュート分を1/2に抑える
    var p1y = p1.y;
    if (p1y > 0) {
        p1y = p1y * 0.5;
    }
    var p2y = p2.y;
    if (p2y > 1) {
        p2y = 1 + (p2y - 1) * 0.5;
    } else if (p2y < 1) {
        p2y = 1 - (1 - p2y) * 0.5;
    }

    var m = 0.1;
    var oi = Math.min(100, Math.max(p1.x, m) * 100);
    var ii = Math.min(100, Math.max(1 - p2.x, m) * 100);
    var ex = Math.max(p1.x, m);
    var ix = Math.min(p2.x, 1 - m);

    return {
        os: (p1y / ex * diff) / dur,
        oi: oi,
        is: ((1 - p2y) / (1 - ix) * diff) / dur,
        ii: ii
    };
}

function NGS_LyricMotion_applyBE(prop, k1, k2, curve) {
    try {
        var p1 = curve.p1;
        var p2 = curve.p2;
        var v1 = prop.keyValue(k1);
        var v2 = prop.keyValue(k2);
        var dur = prop.keyTime(k2) - prop.keyTime(k1);
        var te = prop.keyInTemporalEase(k1);
        var nd = te.length !== undefined ? te.length : 1;
        var isSp = (
            prop.propertyValueType === PropertyValueType.TwoD_SPATIAL ||
            prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL
        );
        var eoA = [];
        var eiA = [];
        var d;

        for (d = 0; d < nd; d++) {
            var df;
            if (isSp && nd === 1) {
                var ds = 0;
                if (v1 instanceof Array) {
                    for (var x = 0; x < v1.length; x++) {
                        var dl = v2[x] - v1[x];
                        ds += dl * dl;
                    }
                    df = Math.sqrt(ds);
                } else {
                    df = v2 - v1;
                }
            } else {
                df = (nd > 1 ? v2[d] : v2) - (nd > 1 ? v1[d] : v1);
            }

            var ez = NGS_LyricMotion_bezToEase(p1, p2, df, dur);
            eoA.push(new KeyframeEase(ez.os, ez.oi));
            eiA.push(new KeyframeEase(ez.is, ez.ii));
        }

        var k1I = [];
        var rk = prop.keyInTemporalEase(k1);
        if (rk.length !== undefined) {
            for (d = 0; d < rk.length; d++) k1I.push(new KeyframeEase(rk[d].speed, rk[d].influence));
        } else {
            k1I.push(new KeyframeEase(rk.speed, rk.influence));
        }

        var k2O = [];
        var ro = prop.keyOutTemporalEase(k2);
        if (ro.length !== undefined) {
            for (d = 0; d < ro.length; d++) k2O.push(new KeyframeEase(ro[d].speed, ro[d].influence));
        } else {
            k2O.push(new KeyframeEase(ro.speed, ro.influence));
        }

        prop.setInterpolationTypeAtKey(k1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        prop.setInterpolationTypeAtKey(k2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        prop.setTemporalEaseAtKey(k1, k1I, eoA);
        prop.setTemporalEaseAtKey(k2, eiA, k2O);
    } catch (e) {}
}

function NGS_LyricMotion_setPosition(layer, newPos) {
    var transform = layer.property("ADBE Transform Group");
    var posProp = transform.property("ADBE Position");
    if (posProp.dimensionsSeparated) {
        var xProp = transform.property("ADBE Position_0");
        var yProp = transform.property("ADBE Position_1");
        xProp.setValue(newPos[0]);
        yProp.setValue(newPos[1]);
        if (newPos.length > 2 && layer.threeDLayer) {
            var zProp = transform.property("ADBE Position_2");
            zProp.setValue(newPos[2]);
        }
    } else {
        posProp.setValue(newPos);
    }
}

function NGS_LyricMotion_centerAnchor(layer, comp) {
    var rect = layer.sourceRectAtTime(comp.time, false);
    if (rect.width === 0 || rect.height === 0) return;

    var newAnchor = [
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
    ];
    var oldAnchor = layer.anchorPoint.value;
    var dx = newAnchor[0] - oldAnchor[0];
    var dy = newAnchor[1] - oldAnchor[1];

    var scale = layer.scale.value;
    var rot = layer.threeDLayer ? layer.zRotation.value : layer.rotation.value;

    var dxs = dx * (scale[0] / 100);
    var dys = dy * (scale[1] / 100);
    var rad = rot * Math.PI / 180;
    var cos = Math.cos(rad);
    var sin = Math.sin(rad);

    layer.anchorPoint.setValue(newAnchor);
    var pos = layer.position.value;
    var newPos = [pos[0] + dxs * cos - dys * sin, pos[1] + dxs * sin + dys * cos];
    if (pos.length > 2) newPos[2] = pos[2];
    NGS_LyricMotion_setPosition(layer, newPos);
}

// シェイプグループのパス頂点からバウンディングボックスを再帰的に計算
function NGS_LyricMotion_getPathBounds(group) {
    var minX = Infinity, maxX = -Infinity;
    var minY = Infinity, maxY = -Infinity;
    var found = false;

    var groupContents = group.property("ADBE Vectors Group");
    if (!groupContents) return null;

    for (var p = 1; p <= groupContents.numProperties; p++) {
        var prop = groupContents.property(p);
        var mm = prop.matchName;

        if (mm === "ADBE Vector Shape - Group") {
            // パスの頂点を読む
            var pathProp = prop.property("ADBE Vector Shape");
            if (pathProp) {
                var pathData = pathProp.value;
                var verts = pathData.vertices;
                for (var v = 0; v < verts.length; v++) {
                    var vx = verts[v][0], vy = verts[v][1];
                    if (vx < minX) minX = vx;
                    if (vx > maxX) maxX = vx;
                    if (vy < minY) minY = vy;
                    if (vy > maxY) maxY = vy;
                    found = true;
                }
            }
        } else if (mm === "ADBE Vector Group") {
            // サブグループ → 再帰的にパス頂点を集める
            var subBounds = NGS_LyricMotion_getPathBounds(prop);
            if (subBounds) {
                var subT = prop.property("ADBE Vector Transform Group");
                var subPos = [0, 0];
                if (subT) {
                    try { subPos = subT.property("ADBE Vector Position").value; } catch (e) {}
                }
                var sx = subBounds.minX + subPos[0];
                var ex = subBounds.maxX + subPos[0];
                var sy = subBounds.minY + subPos[1];
                var ey = subBounds.maxY + subPos[1];
                if (sx < minX) minX = sx;
                if (ex > maxX) maxX = ex;
                if (sy < minY) minY = sy;
                if (ey > maxY) maxY = ey;
                found = true;
            }
        }
    }

    if (!found) return null;
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
}

function NGS_LyricMotion_removeEffects(layer) {
    var effects = layer.property("ADBE Effect Parade");
    if (!effects) return;
    for (var i = effects.numProperties; i >= 1; i--) {
        try { effects.property(i).remove(); } catch (e) {}
    }
}

function NGS_LyricMotion_removeLayerQuietly(layer) {
    if (!layer) return;
    try { layer.remove(); } catch (e) {}
}

function NGS_LyricMotion_remapEffectLayerReferences(group, sourceLayer, outputLayer) {
    if (!group) return 0;
    var warnings = 0;

    for (var i = 1; i <= group.numProperties; i++) {
        var prop = group.property(i);
        if (!prop) continue;

        if (prop.propertyType === PropertyType.PROPERTY) {
            if (prop.propertyValueType !== PropertyValueType.LAYER_INDEX) continue;

            var hasExpression = false;
            var expressionPointsToSource = false;
            try {
                hasExpression = prop.canSetExpression && prop.expressionEnabled;
                expressionPointsToSource = hasExpression && prop.value === sourceLayer.index;
            } catch (eExpression) {}

            if (hasExpression) {
                if (expressionPointsToSource) warnings++;
                continue;
            }

            try {
                if (prop.numKeys > 0) {
                    for (var k = 1; k <= prop.numKeys; k++) {
                        if (prop.keyValue(k) === sourceLayer.index) {
                            prop.setValueAtKey(k, outputLayer.index);
                        }
                    }
                } else if (prop.value === sourceLayer.index) {
                    prop.setValue(outputLayer.index);
                }
            } catch (eValue) {}
        } else {
            warnings += NGS_LyricMotion_remapEffectLayerReferences(prop, sourceLayer, outputLayer);
        }
    }

    return warnings;
}

var NGS_LyricMotion_lastDecomposeError = "";
var NGS_LyricMotion_decomposeWarnings = 0;

function NGS_LyricMotion_decomposeOne(textLayer, comp) {
    NGS_LyricMotion_lastDecomposeError = "";
    var textProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
    var textDoc = textProp.value;
    var fullText = textDoc.text;
    var time = comp.time;
    var visibleChars = [];
    var i;

    for (i = 0; i < fullText.length; i++) {
        var c = fullText.charAt(i);
        if (c !== "\r" && c !== "\n" && c !== " " && c !== "\t" && c !== "\u3000") {
            visibleChars.push({ ch: c, origIdx: i });
        }
    }

    if (visibleChars.length <= 1) {
        if (visibleChars.length === 1) NGS_LyricMotion_centerAnchor(textLayer, comp);
        return visibleChars.length === 1 ? [textLayer] : null;
    }

    var charStyles = [];
    for (i = 0; i < visibleChars.length; i++) {
        var style = null;
        try {
            var range = textDoc.characterRange(visibleChars[i].origIdx, visibleChars[i].origIdx + 1);
            style = {
                fontSize: range.fontSize,
                font: range.font,
                fillColor: range.fillColor,
                applyFill: range.applyFill,
                applyStroke: range.applyStroke,
                strokeColor: range.strokeColor,
                strokeWidth: range.strokeWidth,
                tracking: range.tracking
            };
        } catch (eStyleRead) {}
        charStyles.push(style);
    }

    var measureLayer = null;
    var shapeLayer = null;
    var groupData = [];

    try {
        measureLayer = textLayer.duplicate();
        measureLayer.name = "__NGS_LyricMotion_Measure__";
        measureLayer.enabled = true;
        NGS_LyricMotion_removeEffects(measureLayer);

        for (i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        measureLayer.selected = true;

        var cmdId = app.findMenuCommandId("Create Shapes from Text");
        if (cmdId === 0) cmdId = 3781;
        app.executeCommand(cmdId);

        var selectedAfterConvert = comp.selectedLayers;
        for (i = 0; i < selectedAfterConvert.length; i++) {
            if (selectedAfterConvert[i] instanceof ShapeLayer) {
                shapeLayer = selectedAfterConvert[i];
                break;
            }
        }
        if (!shapeLayer) throw new Error("文字アウトラインを作成できませんでした");

        var contents = shapeLayer.property("ADBE Root Vectors Group");
        if (!contents) throw new Error("文字アウトラインを読み取れませんでした");

        for (var g = 1; g <= contents.numProperties; g++) {
            var group = contents.property(g);
            if (group.matchName !== "ADBE Vector Group") continue;

            var bounds = NGS_LyricMotion_getPathBounds(group);
            if (!bounds) continue;

            var groupPos = [0, 0];
            try {
                var groupTransform = group.property("ADBE Vector Transform Group");
                if (groupTransform) groupPos = groupTransform.property("ADBE Vector Position").value;
            } catch (eGroupTransform) {}

            groupData.push({
                name: group.name,
                minX: bounds.minX + groupPos[0],
                maxX: bounds.maxX + groupPos[0],
                minY: bounds.minY + groupPos[1],
                maxY: bounds.maxY + groupPos[1]
            });
        }
    } catch (eMeasure) {
        NGS_LyricMotion_lastDecomposeError = textLayer.name + ": " + String(eMeasure);
        return null;
    } finally {
        NGS_LyricMotion_removeLayerQuietly(shapeLayer);
        NGS_LyricMotion_removeLayerQuietly(measureLayer);
    }

    if (groupData.length !== visibleChars.length) {
        NGS_LyricMotion_lastDecomposeError = textLayer.name + ": 文字数とアウトライン数が一致しません (" + visibleChars.length + "/" + groupData.length + ")";
        return null;
    }

    var assignedGroups = [];
    var usedGroups = {};
    var ci;

    for (ci = 0; ci < visibleChars.length; ci++) {
        var matchedIndex = -1;
        for (var gi = 0; gi < groupData.length; gi++) {
            if (!usedGroups[gi] && groupData[gi].name === visibleChars[ci].ch) {
                matchedIndex = gi;
                break;
            }
        }
        assignedGroups[ci] = matchedIndex;
        if (matchedIndex >= 0) usedGroups[matchedIndex] = true;
    }

    var nextUnused = 0;
    var charBounds = [];
    for (ci = 0; ci < assignedGroups.length; ci++) {
        if (assignedGroups[ci] < 0) {
            while (nextUnused < groupData.length && usedGroups[nextUnused]) nextUnused++;
            if (nextUnused >= groupData.length) {
                NGS_LyricMotion_lastDecomposeError = textLayer.name + ": 文字アウトラインを対応付けできませんでした";
                return null;
            }
            assignedGroups[ci] = nextUnused;
            usedGroups[nextUnused] = true;
        }

        var assigned = groupData[assignedGroups[ci]];
        charBounds.push({
            cx: (assigned.minX + assigned.maxX) / 2,
            cy: (assigned.minY + assigned.maxY) / 2
        });
    }

    var srcPos = textLayer.position.value;
    var srcScale = textLayer.scale.value;
    var srcRot = textLayer.threeDLayer
        ? textLayer.property("ADBE Transform Group").property("ADBE Rotate Z").value
        : textLayer.rotation.value;
    var sxF = srcScale[0] / 100;
    var syF = srcScale[1] / 100;
    var rad = srcRot * Math.PI / 180;
    var cosR = Math.cos(rad);
    var sinR = Math.sin(rad);
    var resultLayers = [];

    try {
        for (var j = visibleChars.length - 1; j >= 0; j--) {
            var newLayer = textLayer.duplicate();
            resultLayers.push(newLayer);

            var newTextProp = newLayer.property("ADBE Text Properties").property("ADBE Text Document");
            var doc = newTextProp.value;
            doc.text = visibleChars[j].ch;
            if (charStyles[j]) {
                try {
                    doc.fontSize = charStyles[j].fontSize;
                    doc.font = charStyles[j].font;
                    doc.applyFill = charStyles[j].applyFill;
                    doc.fillColor = charStyles[j].fillColor;
                    doc.applyStroke = charStyles[j].applyStroke;
                    doc.strokeColor = charStyles[j].strokeColor;
                    doc.strokeWidth = charStyles[j].strokeWidth;
                    doc.tracking = charStyles[j].tracking;
                } catch (eStyleWrite) {}
            }
            newTextProp.setValue(doc);

            var dupRect = newLayer.sourceRectAtTime(time, false);
            var dupCX = dupRect.left + dupRect.width / 2;
            var dupCY = dupRect.top + dupRect.height / 2;
            var dx = charBounds[j].cx - dupCX;
            var dy = charBounds[j].cy - dupCY;
            var worldDx = (dx * sxF) * cosR - (dy * syF) * sinR;
            var worldDy = (dx * sxF) * sinR + (dy * syF) * cosR;
            var newPos = [srcPos[0] + worldDx, srcPos[1] + worldDy];
            if (srcPos.length > 2) newPos[2] = srcPos[2];

            NGS_LyricMotion_setPosition(newLayer, newPos);
            newLayer.name = visibleChars[j].ch;
            newLayer.enabled = true;
        }

        for (var ri = 0; ri < resultLayers.length; ri++) {
            NGS_LyricMotion_decomposeWarnings += NGS_LyricMotion_remapEffectLayerReferences(
                resultLayers[ri].property("ADBE Effect Parade"),
                textLayer,
                resultLayers[ri]
            );
        }
    } catch (eCreate) {
        for (i = 0; i < resultLayers.length; i++) NGS_LyricMotion_removeLayerQuietly(resultLayers[i]);
        NGS_LyricMotion_lastDecomposeError = textLayer.name + ": " + String(eCreate);
        return null;
    }

    textLayer.enabled = false;
    return resultLayers;
}


// 分解のみ（モーション無し）テスト用
function NGS_LyricMotion_decomposeOnly() {
    var comp = app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) return "No comp";
    var sel = comp.selectedLayers;
    if (!sel || sel.length === 0) return "No selection";
    var count = 0;
    for (var i = 0; i < sel.length; i++) {
        if (sel[i] instanceof TextLayer) {
            var result = NGS_LyricMotion_decomposeOne(sel[i], comp);
            if (result) count += result.length;
        }
    }
    return "Decomposed: " + count + " chars";
}

function NGS_LyricMotion_apply(payload) {
    try {
        NGS_LyricMotion_lastDecomposeError = "";
        NGS_LyricMotion_decomposeWarnings = 0;
        var s = NGS_LyricMotion_parseJSON(payload);
        var comp = app.project.activeItem;

        if (!(comp && comp instanceof CompItem)) {
            return NGS_LyricMotion_stringify({ error: "コンポを開いてね" });
        }

        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) {
            return NGS_LyricMotion_stringify({ error: "レイヤーを選んでね" });
        }

        var fd = comp.frameDuration;
        var groups = [];  // グループ単位で管理（各テキストレイヤーごと）
        var i;

        // === Phase 1: テキスト分解（undoグループの外で実行） ===
        // Create Shapes from Text が内部で独自の undo を持つため
        for (i = 0; i < sel.length; i++) {
            if (sel[i] instanceof TextLayer) {
                var decomposed = NGS_LyricMotion_decomposeOne(sel[i], comp);
                if (decomposed) {
                    groups.push(decomposed);
                }
            } else {
                groups.push([sel[i]]);
            }
        }

        if (groups.length === 0) {
            if (NGS_LyricMotion_lastDecomposeError) {
                return NGS_LyricMotion_stringify({ error: NGS_LyricMotion_lastDecomposeError });
            }
            return NGS_LyricMotion_stringify({ error: "分解できるレイヤーがないよ" });
        }

        // 各グループ内でソート
        for (var gi = 0; gi < groups.length; gi++) {
            groups[gi].sort(function (a, b) {
                return s.staggerReverse ? b.index - a.index : a.index - b.index;
            });
        }

        var outCurve;
        var hasOut = (s.useOut !== false);
        if (hasOut) {
            outCurve = s.outCurve;
        }
        var outDur = s.useSameOut ? s.inDur : s.outDur;
        var outX = s.useSameOut ? -s.moveX : s.outX;
        var outY = s.useSameOut ? -s.moveY : s.outY;
        var outZ = s.useSameOut ? -s.moveZ : s.outZ;

        // === Phase 2: モーション適用（undoグループの中） ===
        app.beginUndoGroup("NGS LyricMotion");
        var processed = 0;

        for (var gi = 0; gi < groups.length; gi++) {
            var grpLayers = groups[gi];

            // グループ内のベース inPoint / outPoint を記録
            var baseInPoints = [];
            var baseOutPoints = [];
            for (i = 0; i < grpLayers.length; i++) {
                baseInPoints.push(grpLayers[i].inPoint);
                baseOutPoints.push(grpLayers[i].outPoint);
            }

            var lastAxis = -1;
            var sameCount = 0;

            for (i = 0; i < grpLayers.length; i++) {
                try {
                var ly = grpLayers[i];
                var offset = i * NGS_LyricMotion_num(s.stagger, 0) * fd;
            var t0 = baseInPoints[i] + offset;
            var t1 = t0 + NGS_LyricMotion_num(s.inDur, 8) * fd;
            var t3, t2;
            if (hasOut) {
                t3 = baseOutPoints[i] + offset;
                t2 = t3 - NGS_LyricMotion_num(outDur, 8) * fd;
                if (t2 < t1) t2 = t1;
            } else {
                t3 = baseOutPoints[i] + offset;
                t2 = t3;
            }
            var inX = NGS_LyricMotion_num(s.moveX, 0);
            var inY = NGS_LyricMotion_num(s.moveY, 0);
            var endX = NGS_LyricMotion_num(outX, 0);
            var endY = NGS_LyricMotion_num(outY, 0);

            var dirMode = s.randomDirection !== undefined ? s.randomDirection : (s.randomAxis ? 2 : 1);

            if (dirMode === 2 || dirMode === 4) {
                var inMag = inX !== 0 ? inX : inY;
                var endMag = endX !== 0 ? endX : endY;
                
                var is4Dir = (dirMode === 4);
                if (is4Dir) {
                    inMag = Math.abs(inMag);
                    endMag = Math.abs(endMag);
                }

                var chooseX;
                if (sameCount >= 2) {
                    // 強制的に反対の軸
                    chooseX = (lastAxis !== 0);
                } else {
                    chooseX = (Math.random() < 0.5);
                }
                var axis = chooseX ? 0 : 1;
                if (axis === lastAxis) {
                    sameCount++;
                } else {
                    lastAxis = axis;
                    sameCount = 1;
                }
                
                var sign = 1;
                if (is4Dir) {
                    sign = (Math.random() < 0.5) ? 1 : -1;
                }

                if (chooseX) {
                    inX = inMag * sign;
                    inY = 0;
                    endX = endMag * sign;
                    endY = 0;
                } else {
                    inX = 0;
                    inY = inMag * sign;
                    endX = 0;
                    endY = endMag * sign;
                }
            }



            var transform = ly.property("ADBE Transform Group");
            var pp = transform.property("ADBE Position");
            var hasZ = ly.threeDLayer;

            // 一度結合状態に戻してからベース位置を取得
            try { pp.dimensionsSeparated = false; } catch (eJoin) {}
            var base = pp.value;
            var bx = base[0];
            var by = base[1];
            var bz = hasZ ? base[2] : 0;

            // 既存キーを全削除
            while (pp.numKeys > 0) pp.removeKey(1);

            // 次元分割
            pp.dimensionsSeparated = true;

            var inZVal = NGS_LyricMotion_num(s.moveZ, 0);
            var outZVal = NGS_LyricMotion_num(outZ, 0);

            var xProp = transform.property("ADBE Position_0");
            var yProp = transform.property("ADBE Position_1");

            // X
            while (xProp.numKeys > 0) xProp.removeKey(1);
            xProp.setValueAtTime(t0, bx + inX);
            xProp.setValueAtTime(t1, bx);
            if (hasOut) {
                if (t2 > t1 + fd) {
                    xProp.setValueAtTime(t2, bx);
                    xProp.setValueAtTime(t3, bx + endX);
                    NGS_LyricMotion_applyBE(xProp, 1, 2, s.inCurve);
                    NGS_LyricMotion_applyBE(xProp, 3, 4, outCurve);
                } else {
                    xProp.setValueAtTime(t3, bx + endX);
                    NGS_LyricMotion_applyBE(xProp, 1, 2, s.inCurve);
                    if (t3 > t1 + fd) NGS_LyricMotion_applyBE(xProp, 2, 3, outCurve);
                }
            } else {
                NGS_LyricMotion_applyBE(xProp, 1, 2, s.inCurve);
            }

            // Y
            while (yProp.numKeys > 0) yProp.removeKey(1);
            yProp.setValueAtTime(t0, by + inY);
            yProp.setValueAtTime(t1, by);
            if (hasOut) {
                if (t2 > t1 + fd) {
                    yProp.setValueAtTime(t2, by);
                    yProp.setValueAtTime(t3, by + endY);
                    NGS_LyricMotion_applyBE(yProp, 1, 2, s.inCurve);
                    NGS_LyricMotion_applyBE(yProp, 3, 4, outCurve);
                } else {
                    yProp.setValueAtTime(t3, by + endY);
                    NGS_LyricMotion_applyBE(yProp, 1, 2, s.inCurve);
                    if (t3 > t1 + fd) NGS_LyricMotion_applyBE(yProp, 2, 3, outCurve);
                }
            } else {
                NGS_LyricMotion_applyBE(yProp, 1, 2, s.inCurve);
            }

            // Z (3Dレイヤーのみ)
            if (hasZ) {
                var zProp = transform.property("ADBE Position_2");
                while (zProp.numKeys > 0) zProp.removeKey(1);
                zProp.setValueAtTime(t0, bz + inZVal);
                zProp.setValueAtTime(t1, bz);
                if (hasOut) {
                    if (t2 > t1 + fd) {
                        zProp.setValueAtTime(t2, bz);
                        zProp.setValueAtTime(t3, bz + outZVal);
                        NGS_LyricMotion_applyBE(zProp, 1, 2, s.inCurve);
                        NGS_LyricMotion_applyBE(zProp, 3, 4, outCurve);
                    } else {
                        zProp.setValueAtTime(t3, bz + outZVal);
                        NGS_LyricMotion_applyBE(zProp, 1, 2, s.inCurve);
                        if (t3 > t1 + fd) NGS_LyricMotion_applyBE(zProp, 2, 3, outCurve);
                    }
                } else {
                    NGS_LyricMotion_applyBE(zProp, 1, 2, s.inCurve);
                }
            }

            if (s.useOpacity) {
                var op = transform.property("ADBE Opacity");
                while (op.numKeys > 0) op.removeKey(1);
                op.setValueAtTime(t0, NGS_LyricMotion_num(s.opIn, 0));
                op.setValueAtTime(t1, 100);
                if (hasOut) {
                    if (t2 > t1 + fd) {
                        op.setValueAtTime(t2, 100);
                        op.setValueAtTime(t3, NGS_LyricMotion_num(s.opOut, 0));
                        NGS_LyricMotion_applyBE(op, 1, 2, s.inCurve);
                        NGS_LyricMotion_applyBE(op, 3, 4, outCurve);
                    } else {
                        op.setValueAtTime(t3, NGS_LyricMotion_num(s.opOut, 0));
                        NGS_LyricMotion_applyBE(op, 1, 2, s.inCurve);
                        if (t3 > t1 + fd) NGS_LyricMotion_applyBE(op, 2, 3, outCurve);
                    }
                } else {
                    NGS_LyricMotion_applyBE(op, 1, 2, s.inCurve);
                }
            }

            if (s.useScale) {
                var sp = transform.property("ADBE Scale");
                var bs = sp.value;
                var holdScale = [bs[0], bs[1], bs.length >= 3 ? bs[2] : 100];
                var scInVal = NGS_LyricMotion_num(s.scIn, 100);
                var scOutVal = NGS_LyricMotion_num(s.scOut, 100);
                while (sp.numKeys > 0) sp.removeKey(1);
                sp.setValueAtTime(t0, [scInVal, scInVal, scInVal]);
                sp.setValueAtTime(t1, holdScale);
                if (hasOut) {
                    if (t2 > t1 + fd) {
                        sp.setValueAtTime(t2, holdScale);
                        sp.setValueAtTime(t3, [scOutVal, scOutVal, scOutVal]);
                        NGS_LyricMotion_applyBE(sp, 1, 2, s.inCurve);
                        NGS_LyricMotion_applyBE(sp, 3, 4, outCurve);
                    } else {
                        sp.setValueAtTime(t3, [scOutVal, scOutVal, scOutVal]);
                        NGS_LyricMotion_applyBE(sp, 1, 2, s.inCurve);
                        if (t3 > t1 + fd) NGS_LyricMotion_applyBE(sp, 2, 3, outCurve);
                    }
                } else {
                    NGS_LyricMotion_applyBE(sp, 1, 2, s.inCurve);
                }
            }

            if (s.useRotation) {
                var rp = transform.property("ADBE Rotate Z");
                var baseRot = rp.value;
                var rotInVal = NGS_LyricMotion_num(s.rotIn, 0);
                var rotOutVal = NGS_LyricMotion_num(s.rotOut, 0);
                while (rp.numKeys > 0) rp.removeKey(1);
                rp.setValueAtTime(t0, baseRot + rotInVal);
                rp.setValueAtTime(t1, baseRot);
                if (hasOut) {
                    if (t2 > t1 + fd) {
                        rp.setValueAtTime(t2, baseRot);
                        rp.setValueAtTime(t3, baseRot + rotOutVal);
                        NGS_LyricMotion_applyBE(rp, 1, 2, s.inCurve);
                        NGS_LyricMotion_applyBE(rp, 3, 4, outCurve);
                    } else {
                        rp.setValueAtTime(t3, baseRot + rotOutVal);
                        NGS_LyricMotion_applyBE(rp, 1, 2, s.inCurve);
                        if (t3 > t1 + fd) NGS_LyricMotion_applyBE(rp, 2, 3, outCurve);
                    }
                } else {
                    NGS_LyricMotion_applyBE(rp, 1, 2, s.inCurve);
                }
            }

            // レイヤー表示をずらし位置に合わせる
            ly.inPoint = t0;
            ly.outPoint = t3;
            processed++;
            } catch (eLayer) {
                // 個別レイヤーのエラーをスキップして次へ
            }
            }
        }
        app.endUndoGroup();

        return NGS_LyricMotion_stringify({
            ok: true,
            count: processed,
            warnings: NGS_LyricMotion_decomposeWarnings,
            warning: NGS_LyricMotion_decomposeWarnings > 0
                ? "式で元レイヤーを参照しているエフェクト項目は変更していません"
                : ""
        });
    } catch (e) {
        try {
            app.endUndoGroup();
        } catch (ignore) {}
        return NGS_LyricMotion_stringify({ error: "L" + e.line + ": " + String(e) });
    }
}

function NGS_LyricMotion_debugDecompose() {
    try {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) return "コンポを開いてね";
        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) return "レイヤーを選んでね";
        var textLayer = null;
        for (var i = 0; i < sel.length; i++) {
            if (sel[i] instanceof TextLayer) { textLayer = sel[i]; break; }
        }
        if (!textLayer) return "テキストレイヤーを選んでね";

        var textProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
        var textDoc = textProp.value;
        var fullText = textDoc.text;
        var lines = fullText.split(/\r\n|\r|\n/);

        // baselineLocs
        var baselineLocs = textDoc.baselineLocs;
        var baseline0Y = baselineLocs ? baselineLocs[1] : 0;

        var info = "=== DEBUG v4 (baselineLocs) ===\n";
        info += "text: " + fullText.substring(0, 30) + "\n";
        info += "lines: " + lines.length + "\n";
        info += "fontSize: " + textDoc.fontSize + "\n";
        info += "origAnchor: [" + Math.round(textLayer.anchorPoint.value[0]) + "," + Math.round(textLayer.anchorPoint.value[1]) + "]\n";
        info += "origPos: [" + Math.round(textLayer.position.value[0]) + "," + Math.round(textLayer.position.value[1]) + "]\n";

        // baselineLocs 生データ
        info += "--- baselineLocs ---\n";
        if (baselineLocs) {
            info += "total values: " + baselineLocs.length + "\n";
            for (var li = 0; li < lines.length; li++) {
                var locIdx = li * 4;
                if (locIdx + 3 < baselineLocs.length) {
                    var startX = Math.round(baselineLocs[locIdx]);
                    var startY = Math.round(baselineLocs[locIdx + 1]);
                    var endX = Math.round(baselineLocs[locIdx + 2]);
                    var endY = Math.round(baselineLocs[locIdx + 3]);
                    var lineLen = lines[li].length;
                    var charW = lineLen > 0 ? Math.round((baselineLocs[locIdx + 2] - baselineLocs[locIdx]) / lineLen) : 0;
                    info += "L" + (li + 1) + " [" + lines[li].substring(0, 10) + "]: startX=" + startX + " endX=" + endX + " baseY=" + startY + " charW=" + charW + " len=" + lineLen + "\n";
                }
            }
        } else {
            info += "baselineLocs is null!\n";
        }

        // 先頭5文字のcharCenter計算結果
        info += "--- charCenters (first 5) ---\n";
        var charCount = 0;
        for (var li = 0; li < lines.length && charCount < 5; li++) {
            var line = lines[li];
            var locIdx = li * 4;
            if (locIdx + 3 >= baselineLocs.length) continue;
            var lStartX = baselineLocs[locIdx];
            var lBaseY = baselineLocs[locIdx + 1];
            var lEndX = baselineLocs[locIdx + 2];
            var lCharW = line.length > 0 ? (lEndX - lStartX) / line.length : 0;

            for (var ci = 0; ci < line.length && charCount < 5; ci++) {
                var ch = line.charAt(ci);
                if (ch === " " || ch === "\u3000" || ch === "\t") continue;

                var charCX = lStartX + (ci + 0.5) * lCharW;
                var lineOffY = lBaseY - baseline0Y;
                info += ch + ": cx=" + Math.round(charCX) + " lineOffY=" + Math.round(lineOffY) + " (L" + (li + 1) + " pos=" + ci + ")\n";
                charCount++;
            }
        }

        return info;
    } catch (e) {
        return "エラー: L" + e.line + " " + String(e);
    }
}



function NGS_LyricMotion_decomposeOnly() {
    try {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) return "コンポを開いてね";
        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) return "レイヤーを選んでね";
        var count = 0;
        for (var i = 0; i < sel.length; i++) {
            if (sel[i] instanceof TextLayer) {
                var result = NGS_LyricMotion_decomposeOne(sel[i], comp);
                if (result) count += result.length;
            }
        }
        return "分解完了: " + count + " レイヤー";
    } catch (e) {
        return "エラー: L" + e.line + " " + String(e);
    }
}
