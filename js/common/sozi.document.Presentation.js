/*
 * Sozi - A presentation tool using the SVG standard
 *
 * Copyright (C) 2010-2013 Guillaume Savaton
 *
 * This program is dual licensed under the terms of the MIT license
 * or the GNU General Public License (GPL) version 3.
 * A copy of both licenses is provided in the doc/ folder of the
 * official release of Sozi.
 *
 * See http://sozi.baierouge.fr/wiki/en:license for details.
 */

namespace("sozi.document", function (exports) {
    "use strict";

    // Constant: the SVG namespace
    var SVG_NS = "http://www.w3.org/2000/svg";

    // Constant: the Inkscape namespace
    var INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";

    // Constant: The SVG element names that can be found in layers
    var DRAWABLE_TAGS = [ "g", "image", "path", "rect", "circle",
        "ellipse", "line", "polyline", "polygon", "text", "clippath" ];

    exports.Frame = sozi.model.Object.create({

        init: function (pres, state) {
            sozi.model.Object.init.call(this);

            this.presentation = pres;
            this.state = state;

            this.frameId = "frame" + this.id;
            this.title = "New frame";
            this.selected = false;

            return this;
        }
    });

    exports.Presentation = sozi.model.Object.create({

        /*
         * Initialize a Sozi document object.
         *
         * Parameters:
         *    - svgRoot: The root element of the SVG document.
         *
         * Returns:
         *    - The current document object.
         */
        init: function (svgRoot) {
            sozi.model.Object.init.call(this);

            this.svgRoot = svgRoot;

            this.layers = {};
            this.frames = [];

            // Create an empty wrapper layer for elements that do not belong to a valid layer
            var wrapperCount = 0;
            var svgWrapper = document.createElementNS(SVG_NS, "g");
            svgWrapper.setAttribute("id", "sozi-wrapper-" + this.id + "-" + wrapperCount);

            // Get all child nodes of the SVG root.
            // Make a copy of svgRoot.childNodes before modifying the document.
            var svgNodeList = Array.prototype.slice.call(svgRoot.childNodes);

            svgNodeList.forEach(function (svgNode) {
                // Remove text nodes and comments
                if (svgNode.tagName === undefined) {
                    svgRoot.removeChild(svgNode);
                }
                // Reorganize SVG elements
                else {
                    var nodeName = svgNode.localName.toLowerCase();
                    if (DRAWABLE_TAGS.indexOf(nodeName) !== -1) {
                        // The current node is a valid layer if it has the following characteristics:
                        //    - it is an SVG group element
                        //    - it has an id
                        //    - the id has not been met before.
                        if (nodeName === "g" && svgNode.getAttribute("id") && !(svgNode.getAttribute("id") in this.layers)) {
                            // If the current wrapper layer contains elements,
                            // add it to the document and to the list of layers.
                            if (svgWrapper.firstChild) {
                                svgRoot.insertBefore(svgWrapper, svgNode);
                                this.layers[svgWrapper.getAttribute("id")] = {
                                    auto: true,
                                    selected: true,
                                    label: "#" + svgWrapper.getAttribute("id"),
                                    svgNode: svgWrapper
                                };

                                // Create a new empty wrapper layer
                                wrapperCount ++;
                                svgWrapper = document.createElementNS(SVG_NS, "g");
                                svgWrapper.setAttribute("id", "sozi-wrapper-" + this.id + "-" + wrapperCount);
                            }

                            // Add the current node to the list of layers.
                            this.layers[svgNode.getAttribute("id")] = {
                                auto: false,
                                selected: true,
                                // FIXME Should be has/getAttributeNS(INKSCAPE_NS, "label"
                                label: svgNode.hasAttribute("inkscape:label") ? svgNode.getAttribute("inkscape:label") : ("#" + svgNode.getAttribute("id")),
                                svgNode: svgNode
                            };
                        }
                        else {
                            svgWrapper.appendChild(svgNode);
                        }
                    }
                }
            }, this);

            // If the current wrapper layer contains elements,
            // add it to the document and to the list of layers.
            if (svgWrapper.firstChild) {
                svgRoot.appendChild(svgWrapper);
                this.layers[svgWrapper.getAttribute("id")] = {
                    auto: true,
                    selected: true,
                    svgNode: svgWrapper
                };
            }

            return this;
        },

        /*
         * Mark all layers as selected.
         *
         * Fires:
         *    - selectLayer(layerId)
         *
         * Returns:
         *    - The current object.
         */
        selectAllLayers: function () {
            for (var layerId in this.layers) {
                this.selectLayer(layerId);
            }
            return this;
        },

        /*
         * Mark all layers as deselected.
         *
         * Fires:
         *    - deselectLayer(layerId)
         *
         * Returns:
         *    - The current object.
         */
        deselectAllLayers: function () {
            for (var layerId in this.layers) {
                this.deselectLayer(layerId);
            }
            return this;
        },

        /*
         * Mark a layer as selected.
         *
         * When selecting a layer, the previously selected layers are not deselected.
         *
         * Parameters:
         *    - layerId: The id of the layer to select.
         *
         * Fires:
         *    - selectLayer(layerId)
         *
         * Returns:
         *    - The current object.
         */
        selectLayer: function (layerId) {
            this.layers[layerId].selected = true;
            this.fire("selectLayer", layerId);
            return this;
        },

        /*
         * Mark a layer as deselected.
         *
         * Parameters:
         *    - layerId: The id of the layer to deselect.
         *
         * Fires:
         *    - deselectLayer(layerId)
         *
         * Returns:
         *    - The current object.
         */
        deselectLayer: function (layerId) {
            this.layers[layerId].selected = false;
            this.fire("deselectLayer", layerId);
            return this;
        },

        /*
         * Mark all frames as selected.
         *
         * Fires:
         *    - selectFrame(frameIndex)
         *
         * Returns:
         *    - The current object.
         */
        selectAllFrames: function () {
            for (var frameIndex = 0; frameIndex < this.frames.length; frameIndex ++) {
                this.selectFrame(frameIndex);
            }
            return this;
        },

        /*
         * Mark all frames as deselected.
         *
         * Fires:
         *    - deselectFrame(frameIndex)
         *
         * Returns:
         *    - The current object.
         */
        deselectAllFrames: function () {
            for (var frameIndex = 0; frameIndex < this.frames.length; frameIndex ++) {
                this.deselectFrame(frameIndex);
            }
            return this;
        },

        /*
         * Mark a frame as selected.
         *
         * Parameters:
         *    - frameIndex: The index of the frame to select
         *
         * Fires:
         *    - selectFrame(frameIndex)
         *
         * Returns:
         *    - The current object.
         */
        selectFrame: function (frameIndex) {
            this.frames[frameIndex].selected = true;
            this.fire("selectFrame", frameIndex);
            return this;
        },

        /*
         * Mark a frame as deselected.
         *
         * Parameters:
         *    - frameIndex: The index of the frame to deselect
         *
         * Fires:
         *    - deselectFrame(frameIndex)
         *
         * Returns:
         *    - The current object.
         */
        deselectFrame: function (frameIndex) {
            this.frames[frameIndex].selected = false;
            this.fire("deselectFrame", frameIndex);
            return this;
        },

        addFrame: function (state) {
            var frame = sozi.document.Frame.create().init(this, state);
            for (var frameIndex = this.frames.length - 1; frameIndex >= 0; frameIndex --) {
                if (this.frames[frameIndex].selected) {
                    this.frames.splice(frameIndex + 1, 0, frame);
                    break;
                }
            }
            if (frameIndex === -1) {
                frameIndex = this.frames.length;
                this.frames.push(frame);
            }
            this.fire("addFrame", frame, frameIndex);
            this.deselectAllFrames();
            this.selectFrame(frameIndex);
            return frame;
        }
    });
});