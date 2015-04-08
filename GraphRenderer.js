/*global d3, SeedWidgets, AbstractRenderer, ShapeNode */

function GraphRenderer(domQuery) { //for a whole window call with domQuery "<body>"

    "use strict";

    //inherit the base class
    var self = AbstractRenderer(domQuery);
    self.initialized = false;

    self.popupWindow = null;

    /**
     * structure that holds tree structure for each shape prepared for d3.js
     * { seed.ID: { tree structure for d3.js }, ... }
     *
     * not necesary - the same as self.treeNodes[shape.id][0] == self.roots[shape.id]
     */
    self.roots = new Object();

    /**
     * structure that holds pointers to self.roots nodes
     * { seed.ID: { shape.id: node in self.roots, ... }, ... }
     */
    self.treeNodes = new Object(); //to access self.root nodes in O(1) ... self.treeNodes[shape.id] = reference to node in self.root

    self.graphManager = null;

    self.IsInitialized = function () {
        if (!self.initialized) {
            self.initialized = true;
            return false;
        }
        else
            return true;
    };

    self.initCalls.push(function () {
        window.console && console.log('Just loaded');
        $(domQuery).text("Just loaded the graph renderer.");

        //add button to draw D3 graph
        /*$(domQuery).append(
                $('<button id="drawGraph">Draw graph</button>').click(function () {
            self.collapsibleTree();
        })
                );*/
        
        self.graphManager = GraphManager.getInstance(domQuery);
    });

    self.showInPopup = function () {
        if (self.popupWindow !== null && !self.popupWindow.closed) {
            return;
        }
        self.popupWindow = window.open("", "", "width=" + $(domQuery).width() + ", height=" + $(domQuery).height() + ", resizable=yes, menubar=yes, status=yes");
        if (!self.popupWindow) {
            alert("It seems that your browser has not allowed popup windows for this domain.");
            return;
        }
        var newDomQuery = self.popupWindow.document.body;
        $(newDomQuery).html($(domQuery).clone(true));
        domQuery = newDomQuery;
    };

    /*self.buildJson = function () {

        var seed = SeedWidgets.Instances()[0];

        function buildJsonRec(node, jsonNode, level) {
            if (node.relations.IsLeaf()) {
                return;
            }
            var childNodes = seed.GetChildrenShapes(node);

            //create new property children and assign it to current jsonNode
            jsonNode.children = [];
            jsonNode = jsonNode['children'];
            for (var i = 0; i < childNodes.length; i++) {
                if (childNodes[i] instanceof ShapeNode) { //in case of childNodes is Array [ Object, null ]
                    var newNode = {
                        "name": "child " + i,
                        "shapeId": childNodes[i].id,
                        "level": level
                    };
                    jsonNode.push(newNode);
                    buildJsonRec(childNodes[i], newNode, level + 1);
                }
            }
        }

        function addDescendantCountProperty(node) {
            if (!('children' in node)) {
                node['descendatnCount'] = 0;
                node['leafCount'] = 1;
                return;
            }
            var count = 0;
            var leafCount = 0;
            for (var i = 0; i < node.children.length; i++) {
                addDescendantCountProperty(node.children[i]);
                count += node.children[i].descendatnCount + 1;
                leafCount += node.children[i].leafCount;
            }
            node['descendatnCount'] = count;
            node['leafCount'] = leafCount;
        }

        var root = SeedWidgets.Instances()[0].GetShape(0);
        var rootJSON = {
            "name": "root",
            "shapeId": root.id,
            "level": 0
        };

        buildJsonRec(root, rootJSON, 1);
        addDescendantCountProperty(rootJSON);

        return rootJSON;
    };*/

    self.addCalls.push(function (shape) {
        console.log(shape);
        
        self.graphManager.addShape(shape);
    });

    return self;
}


/**
 * GraphManager singleton class to manage graphs - resends actions to active
 * graph (force collapsible, zoomable circle packing)
 */
var GraphManager = (function () {
    var instance;

    function init(domQuery) {
        // Singleton
        
        // Private methods and variables        
        
        var privateVariable = "Im also private";
        
        var treeNodes = new Object();
        var roots = new Object();
        var width = null;
        var height = null;
        
        addToDOM();
        
        var forceCollaps = new ForceCollapsible(treeNodes, domQuery, width, height);
        var currentGraph = forceCollaps;
        
        function addToDOM() {
            /*d3.select(domQuery).append('button')
             .attr('id', 'showInPopup')
             .text('View graph in new window')
             .on('click', self.showInPopup);*/

            console.log(treeNodes);

            var style = $("<style>\n\
                      " + domQuery + " > svg { overflow: visible; }\n\
                      .node circle { cursor: pointer; stroke: #3182bd; stroke-width: 1.5px; }\n\
                      .node text, .node foreignObject { display: none; }\n\
                      .node:hover text, .node:hover foreignObject { display: block; }\n\
                      .node foreignObject body { margin: 0; padding: 0; background-color: transparent; }\n\
                      .node foreignObject .node-info { background-color: #eee; padding: .5em; border: thin solid #ccc; border-radius: 4px; }\n\
                      .node foreignObject .node-info p { padding: 0; margin: 0; line-height: 1.2em; font-size: 1em; }\n\
                      .link { fill: none; stroke: #9ecae1; stroke-width: 1.5px; }\n\
                      </style>");
            $('html > head').append(style);

            $(domQuery).width(720);
            $(domQuery).height(600);
            width = $(domQuery).width();
            height = $(domQuery).height();
        }

        function privateMethod() {
            console.log("I am private");
        }

        return {
            addShape: function(shape) {
                var isRoot = false;
                var seed = shape.relations.seed;
                var parent = shape.relations.parent;
                
                //if the seed was not initialised yet or it is root element then create new empty object
                if (treeNodes[seed] === undefined || treeNodes[seed][parent] === undefined) {
                    treeNodes[seed] = new Object();
                    isRoot = true;
                }

                var seedObject = treeNodes[seed];

                var newNode = {
                    "id": shape.id, //id to match data and DOM nodes -> node.data(nodes, function(d) { return d.id; });
                    "name": "node " + shape.id,
                    "shapeId": shape.id,
                    "parentId": parent,
                    "level": isRoot ? 0 : seedObject[parent].level + 1,
                    "descendatnCount": 0,
                    "leafCount": shape.relations.IsLeaf() ? 1 : 0
                };

                seedObject[shape.id] = newNode;
                if (isRoot) {
                    roots[seed] = newNode;
                    currentGraph.addTree(seed);
                } else if (parent in seedObject) {

                    var currentPredecessor = parent;
                    var isLeaf = shape.relations.IsLeaf();
                    while (currentPredecessor in seedObject) {
                        seedObject[currentPredecessor]['descendatnCount']++;
                        if (isLeaf) {
                            seedObject[currentPredecessor]['leafCount']++;
                        }
                    }

                    if (seedObject[parent].children === undefined) {
                        seedObject.parent['children'] = [];
                    }
                    seedObject[parent].children.push(newNode);
                }
                
                currentGraph.updateBySeedID(seed);
            },
            update: function() {
                
            },
            // Public methods and variables
            publicMethod: function () {
                console.log("The public can see me!");
            },
            publicProperty: "I am also public"
        };

    }

    return {
        getInstance: function (domQuery) {
            if (!instance) {
                instance = init(domQuery);
            }
            return instance;
        }
    };
})();

function ForceCollapsible(treeNodes, domQuery, width, height) {
    
    var self = this;
    
    //parameters
    this.treeNodes = treeNodes;
    this.trees = new Object();
    this.width = width;
    this.height = height;
    
    this.force = null;
    this.svg = null;
    //this.link = null;
    //this.node = null;
    
    this.init = function() {
        self.force = d3.layout.force()
                .size([self.width, self.height])
                .gravity(.01)
                .charge(function (d) {
                    return d._children ? -d.leafCount * 15 : -30;
                })
                .linkDistance(function (d) {
                    var nodesRadius = nodeRadius(d.target) + nodeRadius(d.source);
                    var nodesDistance = d.target._children ? 60 : d.target.children ? 25 : 15;
                    return nodesRadius + nodesDistance;
                })
                .on("tick", tick);

        self.svg = d3.select(domQuery).append("svg")
                .attr("width", self.width)
                .attr("height", self.height);

        //self.link = self.svg.selectAll(".link");
        //self.node = self.svg.selectAll(".node");

        //self.addTrees();
    };
    this.init();
    
    this.hideNodes = function(root, level) {
        //if there wont be any node.id `id` parameter it should be added before hiding nodes (like previous flatten(root)) which added `id`s to all node
        
        function recurse(node) {
            if (node.children)
                node.children.forEach(recurse);

            if (node.level >= level) {
                if (node.children && node.children.length > 1) {
                    //console.log("toggled level " + node.level);
                    toggle(node);
                }
            }
        }

        recurse(root);
    };
    
    /*this.addTrees = function() {
        for (var seedID in self.treeNodes) {
            if (self.treeNodes.hasOwnProperty(seedID)) {
                if (!(seedID in self.trees)) {
                    self.addTree(seedID);
                }
            }
        }
    };*/
    
    this.addTree = function(seedID) {
        if (self.trees[seedID] === undefined) {
            self.trees[seedID] = new Object();
        }
        self.trees[seedID].root = self.treeNodes[seedID][0];
        self.trees[seedID].root.fixed = true;
        self.trees[seedID].root.x = self.width / 2;
        self.trees[seedID].root.y = self.height / 2;

        var SVGGroup = svg.append("g").attr("seedID", seedID);
        self.trees[seedID].link = SVGGroup.selectAll(".link");
        self.trees[seedID].node = SVGGroup.selectAll(".node");

        self.hideNodes(self.trees[seedID].root, 3);

        self.update(self.trees[seedID]);
    };

    this.updateEachRoot = function() {
        for (var seedID in self.trees) {
            if (self.trees.hasOwnProperty(seedID)) {
                self.update(self.trees[seedID], seedID);
            }
        }
    };

    this.updateBySeedID = function (seedID) {
        self.update(self.trees[seedID], seedID);
    };

    this.update = function (tree, treeID) {
        var nodes = flatten(tree.root),
                links = d3.layout.tree().links(nodes);

        // Restart the force layout.
        self.force
                .nodes(nodes)
                .links(links)
                .start();

        // Update the links…
        tree.link = link.data(links, function (d) {
            return d.target.id;
        });

        // Exit any old links.
        tree.link.exit().remove();

        // Enter any new links.
        tree.link.enter().insert("line", ".node")
                .attr("class", "link")
                .attr("x1", function (d) {
                    return d.source.x;
                })
                .attr("y1", function (d) {
                    return d.source.y;
                })
                .attr("x2", function (d) {
                    return d.target.x;
                })
                .attr("y2", function (d) {
                    return d.target.y;
                });

        // Update the nodes…
        tree.node = tree.node.data(nodes, function (d) {
            return d.id;
        });

        // Exit any old nodes.
        tree.node.exit().remove();

        var nodeEnter = tree.node.enter().append("g")
                .attr("class", function (d) {
                    return d.children ? "node" : "node leaf";
                })
                .attr("data-shape-id", function (d) {
                    return d.shapeId;
                })
                .attr("data-level", function (d) {
                    return d.level;
                })
                .call(self.force.drag);

        // Enter any new nodes.
        nodeEnter.append("circle")
                .attr("r", nodeRadius)
                .on("click", click)
                .on("mouseenter", nodeMouseOver)
                .on("mouseleave", nodeMouseOver);

        //add texts to nodes - try <foreignobject> and then <text> with tspan
        //dx and x not worked when tspan x is set
        var switchElem = nodeEnter.append("switch");

        var foreignObject = switchElem.append("foreignObject")
                .attr("requiredExtensions", "http://www.w3.org/1999/xhtml")
                .attr("width", 170)
                .attr("height", "5em")
                .style("transform", function (d) {
                    var radius = nodeRadius(d);
                    return "translate(" + (radius - .3 * radius) + "px, -2em)"; //x=right-30% from radius, y = 1.5em + .5em(padding)
                });

        var bodyElem = foreignObject.append("xhtml:body");
        var containerElem = bodyElem.append("xhtml:div")
                .attr("class", "node-info");

        containerElem.append("xhtml:p").text(function (d) {
            return "Descendant count: " + d.descendatnCount;
        });
        containerElem.append("xhtml:p").text(function (d) {
            return "Leaf count: " + d.leafCount;
        });
        containerElem.append("xhtml:p").text(function (d) {
            return "Level: " + d.level;
        });

        var texts = switchElem.append("text")
                .style("transform", function (d) {
                    var radius = nodeRadius(d);
                    return "translate(" + (radius) + "px, 0)";
                });

        texts.append("tspan")
                .attr("x", 0)
                .attr("y", 0)
                .text(function (d) {
                    return "Descendant count: " + d.descendatnCount;
                });

        texts.append("tspan")
                .attr("x", 0)
                .attr("y", "1em")
                .text(function (d) {
                    return "Leaf count: " + d.leafCount;
                });

        texts.append("tspan")
                .attr("x", 0)
                .attr("y", "2em")
                .text(function (d) {
                    return "Level: " + d.level;
                });

        node.select("circle")
                .transition()
                .attr("r", nodeRadius)
                .style("fill", color);
    };

    function tick() {
        self.trees[0].link.attr("x1", function (d) {
            return d.source.x;
        })
                .attr("y1", function (d) {
                    return d.source.y;
                })
                .attr("x2", function (d) {
                    return d.target.x;
                })
                .attr("y2", function (d) {
                    return d.target.y;
                });

        //node.attr("cx", function(d) { return d.x = Math.max(radius, Math.min(width - radius, d.x)); })
        //.attr("cy", function(d) { return d.y = Math.max(radius, Math.min(height - radius, d.y)); });
        self.trees[0].node.attr("transform", function (d) {
            var radius = nodeRadius(d);
            var cx = Math.max(radius, Math.min(width - radius, d.x));
            var cy = Math.max(radius, Math.min(height - radius, d.y));
            return "translate(" + cx + "," + cy + ")";
        });
    }

    // Color leaf nodes orange, and packages white or blue.
    function color(d) {
        return d._children ? "#3182bd" : d.children ? "#c6dbef" : "#fd8d3c";
    }

    // Compute radius for node - used more than 3 - placed in separated function
    function nodeRadius(d) {
        return d.children ? 6 : d._children ? Math.sqrt(d.descendatnCount) * 6 : 8;
    }

    // Toggle children.
    function toggle(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
    }

    //toggle all descendants of d
    function toggleAll(d) {
        if (d.children) {
            d.children.forEach(toggleAll);
            toggle(d);
        }
    }

    // Toggle children on click.
    function click(d) {
        if (d3.event.defaultPrevented === false) { // ignore drag
            console.log(d);
            toggle(d);
            console.log(d);
            update();
        }
    }

    // Returns a list of all nodes under the root.
    function flatten(root) {
        var nodes = [], i = 0;

        function recurse(node) {
            if (node.children)
                node.children.forEach(recurse);
            if (!node.id)
                node.id = ++i;

            nodes.push(node);
        }

        recurse(root);
        return nodes;
    }

    //node mouseenter, mouseleave
    function nodeMouseOver(d) {
        var shape = SeedWidgets.Instances()[0].GetShape(d.shapeId);
        if (shape) {
            shape.interaction.visible(!shape.interaction.visible());
        }
    }
}