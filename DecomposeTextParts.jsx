/**
 * Decompose Text Parts and Center Anchor Points
 * 
 * This script takes the selected text layers, converts them to shapes, 
 * separates each shape group (character/part) into its own layer, 
 * and centers the anchor point for each resulting layer.
 */

(function() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Please select a composition.");
        return;
    }

    var selectedLayers = comp.selectedLayers;
    var targets = [];
    var finalSelections = [];

    for (var i = 0; i < selectedLayers.length; i++) {
        if (selectedLayers[i] instanceof TextLayer) {
            targets.push(selectedLayers[i]);
        }
    }

    if (targets.length === 0) {
        alert("Please select one or more text layers.");
        return;
    }

    app.beginUndoGroup("Decompose Text Parts");

    for (var t = 0; t < targets.length; t++) {
        var results = decomposeTextLayer(targets[t]);
        if (results) {
            finalSelections = finalSelections.concat(results);
        }
    }

    // Final selection
    for (var s = 0; s < finalSelections.length; s++) {
        finalSelections[s].selected = true;
    }

    app.endUndoGroup();

    /**
     * Decomposes a single text layer into multiple shape layers.
     */
    function decomposeTextLayer(textLayer) {
        // Deselect all and select only this layer to run the command
        for (var n = 1; n <= comp.numLayers; n++) {
            comp.layer(n).selected = false;
        }
        textLayer.selected = true;

        // Create shapes from text via menu command
        var cmdId = app.findMenuCommandId("Create Shapes from Text");
        if (cmdId === 0) cmdId = 3781; // Fallback for older versions or different locales
        app.executeCommand(cmdId);

        // The newly created shape layer should be the only one selected
        var shapeLayer = comp.selectedLayers[0];
        if (!shapeLayer || !(shapeLayer instanceof ShapeLayer)) {
            return;
        }

        textLayer.enabled = false; // Hide original

        var contents = shapeLayer.property("ADBE Root Vectors Group");
        if (!contents) return;
        
        var numParts = contents.numProperties;
        var resultLayers = [];

        for (var j = 1; j <= numParts; j++) {
            var partLayer = shapeLayer.duplicate();
            partLayer.name = textLayer.name + "_" + j;
            
            var partContents = partLayer.property("ADBE Root Vectors Group");
            
            // Remove other parts from the duplicate
            for (var k = partContents.numProperties; k >= 1; k--) {
                if (k !== j) {
                    partContents.property(k).remove();
                }
            }
            
            // Center anchor point
            centerAnchor(partLayer);
            resultLayers.push(partLayer);
        }

        // Remove the temporary shape layer containing everything
        shapeLayer.remove();
        
        // Return results to be selected later
        return resultLayers;
    }

    /**
     * Centers the anchor point of a layer to its content's bounding box.
     */
    function centerAnchor(layer) {
        var rect = layer.sourceRectAtTime(comp.time, false);
        
        if (rect.width === 0 || rect.height === 0) return;

        var newAnchor = [
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
        ];

        var oldAnchor = layer.anchorPoint.value;
        
        // Calculate delta in layer space
        var dx = newAnchor[0] - oldAnchor[0];
        var dy = newAnchor[1] - oldAnchor[1];

        // Access transform properties
        var scale = layer.scale.value;
        var rot = layer.rotation.value;
        
        // If it's a 3D layer, z-rotation is what we usually want for 2D decomposition
        if (layer.threeDLayer) {
            rot = layer.zRotation.value;
        }

        // Apply scale (percent to multiplier)
        var dxs = dx * (scale[0] / 100);
        var dys = dy * (scale[1] / 100);

        // Apply rotation (degrees to radians)
        var rad = rot * Math.PI / 180;
        var cos = Math.cos(rad);
        var sin = Math.sin(rad);

        // 2D Rotation Matrix
        var finalDx = dxs * cos - dys * sin;
        var finalDy = dxs * sin + dys * cos;

        // Apply new values
        layer.anchorPoint.setValue(newAnchor);

        var oldPos = layer.position.value;
        var newPos = [
            oldPos[0] + finalDx,
            oldPos[1] + finalDy
        ];
        
        if (oldPos.length > 2) {
            newPos[2] = oldPos[2]; // Keep Z as is
        }
        
        layer.position.setValue(newPos);
    }

})();
