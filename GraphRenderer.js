/*global d3, SeedWidgets, AbstractRenderer, ShapeNode */

function GraphRenderer(domQuery) { //for a whole window call with domQuery "<body>"

    "use strict";

    //inherit the base class
    var self = AbstractRenderer(domQuery);
    self.initialized = false;

    self.popupWindow = null;

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
        
        /**
         * structure that holds pointers to self.roots nodes
         * { seed.ID: { shape.id: node in self.roots, ... }, ... }
         */
        var treeNodes = new Object();
        
        var width = null;
        var height = null;
        var svg = null;
        
        addToDOM();
        
        var forceCollaps = new ForceCollapsible(svg, width, height);
        var currentGraph = forceCollaps;
        
        function addToDOM() {
            /*d3.select(domQuery).append('button')
             .attr('id', 'showInPopup')
             .text('View graph in new window')
             .on('click', self.showInPopup);*/

            console.log(treeNodes);

            addStyles();

            //container for graph controls (inputs for collapsing graph, ...)
            $(domQuery).append('<div id="graphControls" data-bind="html: "></div>');

            $(domQuery).width(720);
            $(domQuery).height(600);
            width = $(domQuery).width();
            height = $(domQuery).height();
            
            svg = d3.select(domQuery).append("svg")
                .attr("width", width)
                .attr("height", height);
        }
        
        function addStyles() {
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

                console.log(shape.id + ' : ' + newNode.id);

                seedObject[shape.id] = newNode;
                if (isRoot) {
                    //roots[seed] = newNode;
                    seedObject.root = seedObject[shape.id];
                    seedObject.seedID = seed;
                    currentGraph.addTree(seedObject);
                } else if (parent in seedObject) {

                    var currentPredecessor = parent;
                    var isLeaf = shape.relations.IsLeaf();
                    while (currentPredecessor in seedObject) {
                        seedObject[currentPredecessor]['descendatnCount']++;
                        if (isLeaf) {
                            seedObject[currentPredecessor]['leafCount']++;
                        }
                        currentPredecessor = seedObject[currentPredecessor].parentId;
                    }

                    if (seedObject[parent].children === undefined) {
                        //do not overwrite seedObject[parent] to seedObject.parent because `parent` is numeric
                        seedObject[parent]['children'] = [];
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
            publicProperty: "I am also public",
            publicTreeNodes: treeNodes
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

function ForceCollapsible(svg, width, height) {
    
    var self = this;
    
    //parameters
    //this.treeNodes = treeNodes;
    this.trees = new Object();
    
    this.addTree = function(tree) {
        this.trees[tree.seedID] = new ForceCollapsibleTree(tree, svg, width, height);
    };
    
    this.updateEachTree = function() {
        for (var seedID in self.trees) {
            if (self.trees.hasOwnProperty(seedID)) {
                self.trees[seedID].update(); //update method from ForceCollapsibleTree object
            }
        }
    };

    this.updateBySeedID = function (seedID) {
        if (seedID in self.trees) {
            self.trees[seedID].update();
        } else {
            throw "Tree with seedID `" + seedID + "` was not initialised.";
        }
    };
    
    this.addControls = function() {
        $('#graphControls').append('\n\
            <form class="form-inline">\n\
              <div class="form-group form-group-sm">\n\
                <label for="levelInput">Level</label>\n\
                <input type="text" class="form-control" id="levelInput">\n\
              </div>\n\
              <div class="form-group form-group-sm">\n\
                <label for="seedInput">Seed</label>\n\
                <select class="form-control" id="seedInput" data-bind="options: ">\n\
                    <option>1</option>\n\
                    <option>2</option>\n\
                    <option>3</option>\n\
                    <option>4</option>\n\
                    <option>5</option>\n\
                </select>\n\
                <input type="email" class="form-control" id="exampleInputEmail2" placeholder="jane.doe@example.com">\n\
              </div>\n\
              <button type="submit" class="btn btn-default btn-sm">Send invitation</button>\n\
            </form>\n\
        ');
    };
}

function ForceCollapsibleTree(tree, svg, width, height) {
    
    var self = this;
        
    //private properties
    var seedID = tree.seedID;
    var root = tree.root;
    var link = null;
    var node = null;
    var force = null;
    
    this.init = function() {
        force = d3.layout.force()
                .size([width, height])
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
        
        var SVGGroup = svg.append("g").attr("seedID", seedID);
        link = SVGGroup.selectAll(".link");
        node = SVGGroup.selectAll(".node");
        
        root.fixed = true;
        root.x = width / 2;
        root.y = height / 2;

        //It makes no sense to call hideNodes when tree is not completely loaded - this.init() is called when only root is added
        //self.hideNodes(3);

        //this.update() is called in GraphManager when shape is added
        //self.update();
    };
    
    this.hideNodes = function(level) {
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

    this.update = function () {
        var nodes = flatten(root),
                links = d3.layout.tree().links(nodes);

        // Restart the force layout.
        force
                .nodes(nodes)
                .links(links)
                .start();

        // Update the links…
        link = link.data(links, function (d) {
            return d.target.id;
        });

        // Exit any old links.
        link.exit().remove();

        // Enter any new links.
        link.enter().insert("line", ".node")
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
        node = node.data(nodes, function (d) {
            return d.id;
        });

        // Exit any old nodes.
        node.exit().remove();

        var nodeEnter = node.enter().append("g")
                .attr("class", function (d) {
                    return d.children ? "node" : "node leaf";
                })
                .attr("data-shape-id", function (d) {
                    return d.shapeId;
                })
                .attr("data-level", function (d) {
                    return d.level;
                })
                .call(force.drag);

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
        link.attr("x1", function (d) {
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
        node.attr("transform", function (d) {
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
            self.update();
        }
    }

    // Returns a list of all nodes under the root.
    function flatten(root) {
        var nodes = [], i = 0;

        function recurse(node) {
            if (node.children)
                node.children.forEach(recurse);
            
            //it has just assigned `id` attribute (starting with 0 so this rewrites it to 1 (!0)==true)
            //if (!node.id)
            //    node.id = ++i;

            nodes.push(node);
        }

        recurse(root);
        return nodes;
    }
    
    //node mouseenter, mouseleave
    function nodeMouseOver(d) {
        var shape = SeedWidgets.Instances()[seedID].GetShape(d.shapeId);
        if (shape) {
            shape.interaction.visible(!shape.interaction.visible());
        }
    }
    
    this.init();
}