(function () {
    var logFile = new File(Folder.temp.fsName + "/NGS_LyricMotion_AE_" + app.version.replace(/\./g, "_") + ".txt");
    logFile.encoding = "UTF-8";

    function finish(message) {
        if (logFile.open("w")) {
            logFile.write(message);
            logFile.close();
        }
        try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (eClose) {}
        try { app.quit(); } catch (eQuit) {}
    }

    function assertTrue(condition, message) {
        if (!condition) throw new Error(message);
    }

    try {
        app.newProject();
        var scriptFile = new File($.fileName);
        var hostScript = new File(scriptFile.parent.parent.fsName + "/CSXS/hostscript.jsx");
        $.evalFile(hostScript);

        var comp = app.project.items.addComp("NGS Smoke", 1920, 1080, 1, 3, 30);
        var externalLayer = comp.layers.addNull();
        externalLayer.name = "External Reference";

        var textLayer = comp.layers.addText("ああ\rあA");
        textLayer.name = "Source Text";
        textLayer.position.setValue([960, 540]);
        var textDocument = textLayer.property("ADBE Text Properties").property("ADBE Text Document").value;
        textDocument.fontSize = 120;
        textDocument.leading = 150;
        textDocument.justification = ParagraphJustification.CENTER_JUSTIFY;
        textLayer.property("ADBE Text Properties").property("ADBE Text Document").setValue(textDocument);

        var effects = textLayer.property("ADBE Effect Parade");
        var blur = effects.addProperty("ADBE Gaussian Blur 2");
        blur.name = "Preserved Blur";
        blur.property(1).setValue(12);

        var selfControl = effects.addProperty("ADBE Layer Control");
        selfControl.name = "Self Ref";
        selfControl.property(1).setValue(textLayer.index);

        var externalControl = effects.addProperty("ADBE Layer Control");
        externalControl.name = "External Ref";
        externalControl.property(1).setValue(externalLayer.index);

        var keyedControl = effects.addProperty("ADBE Layer Control");
        keyedControl.name = "Keyed Ref";
        keyedControl.property(1).setValueAtTime(0, textLayer.index);
        keyedControl.property(1).setValueAtTime(1, externalLayer.index);

        var outputLayers = NGS_LyricMotion_decomposeOne(textLayer, comp);
        assertTrue(outputLayers && outputLayers.length === 4, "expected 4 output layers");
        assertTrue(textLayer.enabled === false, "source text must be disabled after success");

        var repeatedPositions = [];
        for (var i = 0; i < outputLayers.length; i++) {
            var output = outputLayers[i];
            var outputEffects = output.property("ADBE Effect Parade");
            assertTrue(outputEffects.property("Preserved Blur") !== null, "blur was not preserved");
            assertTrue(outputEffects.property("Self Ref").property(1).value === output.index, "self layer reference was not remapped");
            assertTrue(outputEffects.property("External Ref").property(1).value === externalLayer.index, "external layer reference changed");
            assertTrue(outputEffects.property("Keyed Ref").property(1).keyValue(1) === output.index, "keyframed self reference was not remapped");
            assertTrue(outputEffects.property("Keyed Ref").property(1).keyValue(2) === externalLayer.index, "keyframed external reference changed");
            if (output.name === "あ") repeatedPositions.push(output.position.value);
        }

        assertTrue(repeatedPositions.length === 3, "expected three repeated characters");
        for (var a = 0; a < repeatedPositions.length; a++) {
            for (var b = a + 1; b < repeatedPositions.length; b++) {
                assertTrue(
                    repeatedPositions[a][0] !== repeatedPositions[b][0] || repeatedPositions[a][1] !== repeatedPositions[b][1],
                    "repeated characters were placed at the same position"
                );
            }
        }

        for (var li = 1; li <= comp.numLayers; li++) {
            assertTrue(comp.layer(li).name !== "__NGS_LyricMotion_Measure__", "temporary measurement layer remained");
        }

        finish("PASS AE " + app.version);
    } catch (e) {
        finish("FAIL AE " + app.version + " line " + e.line + ": " + String(e));
    }
})();
