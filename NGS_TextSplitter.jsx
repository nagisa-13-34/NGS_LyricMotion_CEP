/**
 * NGS_TextSplitter.jsx
 * 
 * テキストレイヤーを「1文字ごと」「単語ごと」「行ごと」に分割するスクリプト
 * 分割後もテキストレイヤーのまま（シェイプ変換なし）
 * 
 * 使い方:
 *   - ドロップダウンでモードを選んで「分解」ボタン
 *   - Ctrl + クリック → 単語モードで実行
 *   - Shift + クリック → 行モードで実行
 *   - 通常クリック → ドロップダウンで選択中のモードで実行
 * 
 * AEの「ファイル > スクリプト > スクリプトファイルを実行」から起動
 * もしくは ScriptUI Panels フォルダに入れてドッキングパネルとして使用
 */

(function(thisObj) {

    // ===== パネル構築 =====
    var panel = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "TextSplitter", undefined, { resizeable: true });

    panel.orientation = "column";
    panel.alignment = ["fill", "fill"];
    panel.alignChildren = ["fill", "top"];
    panel.spacing = 4;
    panel.margins = [4, 4, 4, 4];

    var execBtn = panel.add("button", undefined, "Split");
    execBtn.alignment = ["fill", "fill"];

    var modeList = panel.add("dropdownlist", undefined, ["Char", "Word", "Line"]);
    modeList.selection = 0;
    modeList.maximumSize = [9999, 26];
    modeList.alignment = ["fill", "bottom"];

    // ScriptUI では onClick + keyboardState を使う（addEventListener は非対応の場合あり）
    execBtn.onClick = function() {
        var kb = ScriptUI.environment.keyboardState;
        var mode;
        if (kb.ctrlKey) {
            mode = 1;
            modeList.selection = 1;
        } else if (kb.shiftKey) {
            mode = 2;
            modeList.selection = 2;
        } else {
            mode = modeList.selection ? modeList.selection.index : 0;
        }
        runSplitter(mode);
    };

    panel.onResizing = panel.onResize = function() { this.layout.resize(); };

    if (panel instanceof Window) {
        panel.center();
        panel.show();
    } else {
        panel.layout.layout(true);
        panel.layout.resize();
    }

    // =================================================================
    //  メインロジック
    // =================================================================

    function runSplitter(mode) {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) {
            alert("\u30B3\u30F3\u30DD\u30B8\u30B7\u30E7\u30F3\u3092\u9078\u629E\u3057\u3066\u306D");
            return;
        }

        var sel = comp.selectedLayers;
        var targets = [];
        for (var i = 0; i < sel.length; i++) {
            if (sel[i] instanceof TextLayer) targets.push(sel[i]);
        }

        if (targets.length === 0) {
            alert("\u30C6\u30AD\u30B9\u30C8\u30EC\u30A4\u30E4\u30FC\u3092\u9078\u629E\u3057\u3066\u306D");
            return;
        }

        var modeNames = ["\u6587\u5B57", "\u5358\u8A9E", "\u884C"];

        // 進捗バー作成
        var progressWin = createProgressBar("TextSplitter");
        progressWin.show();

        // === Phase 1: 測定（undoグループの外で実行） ===
        // executeCommand が内部で undo を作るため、外で実行しないと
        // レイヤー参照が壊れる（clayerP is null）
        var measured = [];
        for (var t = 0; t < targets.length; t++) {
            updateProgress(progressWin, 0, "\u6E2C\u5B9A\u4E2D: " + (t + 1) + "/" + targets.length);
            var data = measureTextLayer(comp, targets[t], mode, progressWin);
            if (data) measured.push(data);
        }

        if (measured.length === 0) {
            progressWin.close();
            return;
        }

        // === Phase 2: レイヤー作成（undoグループの中） ===
        app.beginUndoGroup("TextSplitter - " + modeNames[mode]);
        try {
            var allNew = [];
            for (var m = 0; m < measured.length; m++) {
                var result = createSplitLayers(comp, measured[m], progressWin);
                allNew = allNew.concat(result);
            }

            // 新規レイヤーだけ選択
            for (var n = 1; n <= comp.numLayers; n++) comp.layer(n).selected = false;
            for (var s = 0; s < allNew.length; s++) allNew[s].selected = true;
        } finally {
            app.endUndoGroup();
        }

        progressWin.close();
    }

    // =================================================================
    //  Phase 1: テキストレイヤーの測定（undoグループの外）
    // =================================================================

    function measureTextLayer(comp, srcLayer, mode, progressWin) {
        var textProp = srcLayer.property("ADBE Text Properties").property("ADBE Text Document");
        var fullText = textProp.value.text;
        var time = comp.time;

        var chunks = buildChunks(fullText, mode);
        if (chunks.length <= 1) return null;

        var charBoundsMap = measureCharPositions(comp, srcLayer, fullText, time, progressWin);
        if (!charBoundsMap) return null;

        // トランスフォーム情報を記録
        var srcPos = srcLayer.position.value;
        var srcScale = srcLayer.scale.value;
        var srcRot = srcLayer.rotation.value;
        if (srcLayer.threeDLayer) {
            srcRot = srcLayer.property("ADBE Transform Group").property("ADBE Rotate Z").value;
        }

        return {
            srcLayer: srcLayer,
            chunks: chunks,
            charBoundsMap: charBoundsMap,
            srcPos: srcPos,
            srcScale: srcScale,
            srcRot: srcRot,
            time: time,
            mode: mode
        };
    }

    // =================================================================
    //  Phase 2: 分割レイヤーの作成（undoグループの中）
    // =================================================================

    function createSplitLayers(comp, data, progressWin) {
        var srcLayer = data.srcLayer;
        var chunks = data.chunks;
        var charBoundsMap = data.charBoundsMap;
        var srcPos = data.srcPos;
        var srcScale = data.srcScale;
        var srcRot = data.srcRot;
        var time = data.time;
        var mode = data.mode;

        var newLayers = [];

        // 下から並べるため、チャンクを逆順で処理
        // （最初のチャンクが一番上に来るように、最後のチャンクから先にduplicateする）
        for (var c = chunks.length - 1; c >= 0; c--) {
            var chunk = chunks[c];
            if (chunk.text.length === 0) continue;
            if (mode !== 2 && isWhitespaceOnly(chunk.text)) continue;

            var merged = mergeChunkBounds(charBoundsMap, chunk);
            if (!merged) continue;

            updateProgress(progressWin, (chunks.length - c) / chunks.length, "\u30EC\u30A4\u30E4\u30FC\u4F5C\u6210: " + chunk.text);
            var dup = srcLayer.duplicate();
            dup.name = chunk.text;

            var dupTextProp = dup.property("ADBE Text Properties").property("ADBE Text Document");
            var dupDoc = dupTextProp.value;
            dupDoc.text = chunk.text;
            dupTextProp.setValue(dupDoc);

            // 位置補正
            var dupRect = dup.sourceRectAtTime(time, false);

            var chunkCX = merged.left + merged.width / 2;
            var chunkCY = merged.top + merged.height / 2;
            var dupCX = dupRect.left + dupRect.width / 2;
            var dupCY = dupRect.top + dupRect.height / 2;

            var dx = chunkCX - dupCX;
            var dy = chunkCY - dupCY;

            var sx = srcScale[0] / 100;
            var sy = srcScale[1] / 100;
            var rad = srcRot * Math.PI / 180;
            var cosR = Math.cos(rad);
            var sinR = Math.sin(rad);

            var worldDx = (dx * sx) * cosR - (dy * sy) * sinR;
            var worldDy = (dx * sx) * sinR + (dy * sy) * cosR;

            var newPos = [srcPos[0] + worldDx, srcPos[1] + worldDy];
            if (srcPos.length > 2) newPos[2] = srcPos[2];
            dup.position.setValue(newPos);

            newLayers.push(dup);
        }

        srcLayer.enabled = false;
        return newLayers;
    }

    // =================================================================
    //  文字位置測定（シェイプ変換 → パス頂点から正確なバウンディングボックスを計算）
    // =================================================================

    function measureCharPositions(comp, srcLayer, fullText, time, progressWin) {
        // 可視文字マップ: スペース・改行以外の文字インデックスを順番に記録
        // Create Shapes from Text はスペース・改行にはシェイプを作らない
        var visibleChars = [];
        for (var i = 0; i < fullText.length; i++) {
            var c = fullText.charAt(i);
            if (c !== "\r" && c !== "\n" && c !== " " && c !== "\t" && c !== "\u3000") {
                visibleChars.push({ idx: i, ch: c });
            }
        }

        // 対象レイヤーだけ選択
        for (var n = 1; n <= comp.numLayers; n++) comp.layer(n).selected = false;
        srcLayer.selected = true;

        // Create Shapes from Text を実行
        var cmdId = app.findMenuCommandId("Create Shapes from Text");
        if (cmdId === 0) cmdId = 3781;

        try {
            app.executeCommand(cmdId);
        } catch (e) {
            alert("Create Shapes from Text \u306E\u5B9F\u884C\u306B\u5931\u6557: " + e.message);
            return null;
        }

        // シェイプレイヤーを取得
        var shapeLy = null;
        for (var n = 1; n <= comp.numLayers; n++) {
            if (comp.layer(n).selected && comp.layer(n) instanceof ShapeLayer) {
                shapeLy = comp.layer(n);
                break;
            }
        }

        if (!shapeLy) {
            alert("\u30B7\u30A7\u30A4\u30D7\u30EC\u30A4\u30E4\u30FC\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
            return null;
        }

        var contents = shapeLy.property("ADBE Root Vectors Group");
        if (!contents) {
            shapeLy.remove();
            srcLayer.enabled = true;
            return null;
        }

        // === パス頂点からバウンディングボックスを計算 ===
        updateProgress(progressWin, 0.1, "\u30D1\u30B9\u9802\u70B9\u3092\u8AAD\u307F\u53D6\u308A\u4E2D...");

        var groupData = [];
        for (var g = 1; g <= contents.numProperties; g++) {
            var group = contents.property(g);
            var groupName = group.name;

            // グループ内のTransform position
            var gPos = [0, 0];
            try {
                var gTransform = group.property("ADBE Vector Transform Group");
                if (gTransform) {
                    gPos = gTransform.property("ADBE Vector Position").value;
                }
            } catch (e) {}

            // グループ内の全パスから頂点を読み取り
            var groupContents = group.property("ADBE Vectors Group");
            if (!groupContents) continue;

            var minX = Infinity, maxX = -Infinity;
            var minY = Infinity, maxY = -Infinity;

            for (var p = 1; p <= groupContents.numProperties; p++) {
                var prop = groupContents.property(p);
                if (prop.matchName === "ADBE Vector Shape - Group") {
                    try {
                        var pathProp = prop.property("ADBE Vector Shape");
                        if (pathProp) {
                            var verts = pathProp.value.vertices;
                            for (var v = 0; v < verts.length; v++) {
                                var vx = verts[v][0] + gPos[0];
                                var vy = verts[v][1] + gPos[1];
                                if (vx < minX) minX = vx;
                                if (vx > maxX) maxX = vx;
                                if (vy < minY) minY = vy;
                                if (vy > maxY) maxY = vy;
                            }
                        }
                    } catch (e2) {}
                }
            }

            if (minX !== Infinity) {
                groupData.push({
                    name: groupName,
                    minX: minX, maxX: maxX,
                    minY: minY, maxY: maxY
                });
            }

            updateProgress(progressWin, 0.1 + 0.6 * (g / contents.numProperties),
                "\u6E2C\u5B9A\u4E2D: " + g + "/" + contents.numProperties);
        }

        // 後始末
        shapeLy.remove();
        srcLayer.enabled = true;

        // === グループ名で可視文字とマッチング → boundsMap構築 ===
        updateProgress(progressWin, 0.8, "\u30DE\u30C3\u30C1\u30F3\u30B0\u4E2D...");

        var boundsMap = {};
        var usedGroups = {};

        for (var ci = 0; ci < visibleChars.length; ci++) {
            var ch = visibleChars[ci].ch;
            var charIdx = visibleChars[ci].idx;
            var merged = null;

            for (var gi = 0; gi < groupData.length; gi++) {
                if (usedGroups[gi]) continue;
                if (groupData[gi].name === ch) {
                    merged = {
                        minX: groupData[gi].minX, maxX: groupData[gi].maxX,
                        minY: groupData[gi].minY, maxY: groupData[gi].maxY
                    };
                    usedGroups[gi] = true;

                    // 同じ名前の連続グループがあれば結合（複雑な漢字の分割対応）
                    for (var gi2 = gi + 1; gi2 < groupData.length; gi2++) {
                        if (usedGroups[gi2]) continue;
                        if (groupData[gi2].name !== ch) break;
                        merged.minX = Math.min(merged.minX, groupData[gi2].minX);
                        merged.maxX = Math.max(merged.maxX, groupData[gi2].maxX);
                        merged.minY = Math.min(merged.minY, groupData[gi2].minY);
                        merged.maxY = Math.max(merged.maxY, groupData[gi2].maxY);
                        usedGroups[gi2] = true;
                    }
                    break;
                }
            }

            if (merged) {
                boundsMap[charIdx] = {
                    left: merged.minX,
                    top: merged.minY,
                    width: merged.maxX - merged.minX,
                    height: merged.maxY - merged.minY
                };
            }
        }

        return boundsMap;
    }

    // =================================================================
    //  チャンクのバウンディングボックスを結合
    // =================================================================

    function mergeChunkBounds(boundsMap, chunk) {
        var minX = Infinity, minY = Infinity;
        var maxX = -Infinity, maxY = -Infinity;
        var found = false;

        var startIdx = chunk.charIndex;
        var endIdx = startIdx + chunk.text.length;

        for (var i = startIdx; i < endIdx; i++) {
            if (!boundsMap[i]) continue;
            var b = boundsMap[i];
            if (b.left < minX) minX = b.left;
            if (b.top < minY) minY = b.top;
            if (b.left + b.width > maxX) maxX = b.left + b.width;
            if (b.top + b.height > maxY) maxY = b.top + b.height;
            found = true;
        }

        if (!found) return null;
        return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
    }

    // =================================================================
    //  チャンク分割ロジック
    // =================================================================

    function buildChunks(text, mode) {
        var chunks = [];

        if (mode === 0) {
            // --- 文字ごと ---
            for (var i = 0; i < text.length; i++) {
                var ch = text.charAt(i);
                if (ch === "\r" || ch === "\n") continue;
                chunks.push({ text: ch, charIndex: i });
            }
        } else if (mode === 1) {
            // --- 単語ごと ---
            var pos = 0;
            while (pos < text.length) {
                var ch = text.charAt(pos);
                if (ch === "\r" || ch === "\n" || ch === " " || ch === "\t" || ch === "\u3000") {
                    pos++;
                    continue;
                }
                if (isAsciiWord(ch)) {
                    var start = pos;
                    while (pos < text.length && isAsciiWord(text.charAt(pos))) pos++;
                    chunks.push({ text: text.substring(start, pos), charIndex: start });
                } else {
                    chunks.push({ text: ch, charIndex: pos });
                    pos++;
                }
            }
        } else {
            // --- 行ごと ---
            var lines = text.split(/\r\n|\r|\n/);
            var offset = 0;
            for (var i = 0; i < lines.length; i++) {
                if (lines[i].length > 0) {
                    chunks.push({ text: lines[i], charIndex: offset });
                }
                offset += lines[i].length + 1;
            }
        }

        return chunks;
    }

    function isAsciiWord(ch) {
        var code = ch.charCodeAt(0);
        return (code >= 48 && code <= 57) ||
               (code >= 65 && code <= 90) ||
               (code >= 97 && code <= 122) ||
               code === 95 || code === 45;
    }

    function isWhitespaceOnly(str) {
        return /^[\s\u3000]*$/.test(str);
    }

    // =================================================================
    //  進捗バー
    // =================================================================

    function createProgressBar(title) {
        var w = new Window("palette", title, undefined, { closeButton: false });
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.preferredSize = [300, -1];
        w.margins = [16, 12, 16, 12];

        w.statusText = w.add("statictext", undefined, "\u6E96\u5099\u4E2D...");
        w.bar = w.add("progressbar", undefined, 0, 100);
        w.bar.preferredSize = [270, 14];

        w.layout.layout(true);
        w.center();
        return w;
    }

    function updateProgress(w, ratio, msg) {
        if (!w) return;
        w.bar.value = Math.round(ratio * 100);
        if (msg) w.statusText.text = msg;
        w.update();
    }

})(this);
