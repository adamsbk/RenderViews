/*global d3, SeedWidgets, AbstractRenderer, ShapeNode, ko */

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
    
    //when clicked "go" button it removes all shapes of seed in the same order they were been added
    self.removeCalls.push(function (shape) {
        console.log('Seed removed...');
        //console.log(shape);
        
        //remove picking subscription
        var id = shape.id;
        if (id in this.Subscriptions) {
            for (var t in this.Subscriptions[id])
                this.Subscriptions[id][t].dispose();

            delete this.Subscriptions[id];
        }   
        
        self.graphManager.removeShape(shape);
    });
    
    self.addCalls.push(function (shape) {
        //console.log(shape);
        //picking subscriptions are added and removed in graphManager
        self.graphManager.addShape(shape);
        
        var id = shape.id;
        var pickSubscription = shape.interaction.picked.subscribe(function (newVal) {
            self.graphManager.interactionChanged(shape.relations.seed, shape.id, newVal);
        }.bind(self));
        
        //adding subscription to object to make it possible to store multiple subscriptions per shape
        if (id in this.Subscriptions)
            this.Subscriptions[id].pick = pickSubscription;
        else
            this.Subscriptions[id] = {pick: pickSubscription};
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
        
        var svg = null;
        
        addToDOM();
        
        var forceCollaps = new ForceCollapsible(svg);
        var currentGraph = forceCollaps;
        
        function addToDOM() {
            /*d3.select(domQuery).append('button')
             .attr('id', 'showInPopup')
             .text('View graph in new window')
             .on('click', self.showInPopup);*/

            console.log(treeNodes);

            addStyles();

            //container for graph controls (inputs for collapsing graph, ...)
            $(domQuery).append('<div id="graphControls"></div>');

            var width = $(domQuery).width();
            var height = $(domQuery).height() - $(domQuery + ' #graphControls').height();
            
            svg = d3.select(domQuery).append("svg")
                .attr("width", width)
                .attr("height", height);
        
            addAutoSVGResize();
        }
        
        function addStyles() {
            var style = $("<style>\n\
                      " + domQuery + " > svg { overflow: visible; width: 100%; height: 100%; }\n\
                      .node circle { cursor: pointer; /*stroke: #3182bd;*/ stroke-width: 1.5px; }\n\
                      .node[picked=yes] circle { fill: red !important; }\n\
                      .node text, .node .foreignObj { display: none; }\n\
                      .node:hover text, .node:hover .foreignObj { display: block; }\n\
                      .node .foreignObj body { margin: 0; padding: 0; background-color: transparent; }\n\
                      .node .foreignObj .node-info { background-color: #eee; padding: .5em; border: thin solid #ccc; border-radius: 4px; }\n\
                      .node .foreignObj .node-info p { padding: 0; margin: 0; line-height: 1.2em; font-size: 1em; }\n\
                      .link { fill: none; stroke: #9ecae1; stroke-width: 1.5px; }\n\
                      </style>");
            $('html > head').append(style);
        }
        
        function addAutoSVGResize() {
            $(window).resize(function () {
                $(domQuery + " > svg")
                        .attr("width", $(domQuery).width())
                        .attr("height", $(domQuery).height() - $(domQuery + ' #graphControls').height());
            });
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

                //console.log(shape.id + ' : ' + newNode.id);

                seedObject[shape.id] = newNode;
                if (isRoot) {
                    //roots[seed] = newNode;
                    seedObject.root = newNode;
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
                    
                    //push item into children or clustered _children
                    if (seedObject[parent].children) {
                        seedObject[parent].children.push(newNode);
                    } else if ('_children' in seedObject[parent]) {
                        seedObject[parent]._children.push(newNode);
                    }
                    
                    //start clustering at certain level
                    if (seedObject[parent].level >= forceCollaps.CLUSTER_MIN_LEVEL) {
                        if (seedObject[parent].children && (seedObject[parent].level == forceCollaps.CLUSTER_MIN_LEVEL || seedObject[parent].children.length > 1 )) {
                            seedObject[parent]._children = seedObject[parent].children;
                            seedObject[parent].children = null;
                        }
                    }
                }
                
                currentGraph.updateBySeedID(seed);
            },
            removeShape: function(shape) {
                var seed = shape.relations.seed;
                if (!(seed in treeNodes)) {
                    throw "Seed of Shape you are removing is not defined.";
                }
                if (treeNodes[seed][shape.id] === undefined) {
                    throw "There is not such a shape to remove";
                }
                //delete removes only reference so treeNodes[seed].root should keep reference to object if treeNodes[seed][shape.id] === treeNodes[seed].root
                //instead delete could be assigned undefined - faster
                delete treeNodes[seed][shape.id];
                if (treeNodes[seed].root !== undefined && treeNodes[seed].root.id === shape.id) { //if this shape is parent shape
                    console.log("root reference was deleted successfuly");
                    currentGraph.removeTree(seed);
                    delete treeNodes[seed].root;
                    
                    //seed could not be removed, because root shape is deleted firstly in the "go" button clicked
                    //delete treeNodes[seed];
                }
                //update not working because first removed shape is root in "go" reload
                //currentGraph.updateBySeedID(seed);
            },
            interactionChanged: function(seedID, shapeID, newVal) {
                currentGraph.interactionChanged(seedID, shapeID, newVal);
            },
            update: function() {
                
            },
            // Public methods and variables
            publicMethod: function () {
                console.log("The public can see me!");
            },
            publicProperty: "I am also public",
            publicTreeNodes: treeNodes,
            publicCurrentGraph: currentGraph
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

function ForceCollapsible(svg) {
    
    var self = this;
    
    this.CLUSTER_MIN_LEVEL = 6;
    
    //parameters
    //this.treeNodes = treeNodes;
    this.trees = new Object();
    this.count = 0;
        
    this.init = function() {
        self.addControls();
    };
    
    this.addTree = function(tree) {   
        self.count++;
        self.trees[tree.seedID] = new ForceCollapsibleTree(tree, svg);
        $('#seedInput, #showSeedsInput').append('<option value="'+ tree.seedID +'">Seed #'+ tree.seedID +'</option>');
    };
    
    this.removeTree = function(seedID) {
        if (!(seedID in self.trees)) {
            throw "There does not exist tree with property " + seedID + " in ForceCollapsible.trees object";
        }
        $('#seedInput, #showSeedsInput').children('option[value="'+ seedID +'"]').remove();
        
        self.trees[seedID].remove();
        delete self.trees[seedID];
        self.count--;
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
            self.trees[seedID].updateWithDelay();
        } else {
            throw "Tree with seedID `" + seedID + "` was not initialised.";
        }
    };
    
    this.collapseTrees = function(level, seedID) {
        if (seedID === undefined) { //if seedID is undefined collapse each tree
            for (var seedID in self.trees) {
                if (self.trees.hasOwnProperty(seedID)) {
                    self.trees[seedID].hideNodes(level);
                }
            }
        } else {
            if (seedID in self.trees) {
                self.trees[seedID].hideNodes(level);
            } else {
                throw "There is not tree with SeedID " + seedID + " to collapse";
            }
        }
    };
    
    this.addControls = function() {
        $('#graphControls').append($('\n\
            <form class="form-inline" id="forceCollapsibleControls">\n\
              <div class="form-group form-group-sm">\n\
                <label for="levelInput">Level</label>\n\
                <input type="text" class="form-control" id="levelInput">\n\
              </div>\n\
              <div class="form-group form-group-sm">\n\
                <label for="seedInput">Seed</label>\n\
                <select class="form-control" id="seedInput">\n\
                    <option value="-1">all</option>\n\
                </select>\n\
              </div>\n\
              <button type="submit" class="btn btn-default btn-sm">Cluster</button>\n\
            </form>\n\
        ').submit(self.submitControls));
        
        $('#graphControls').append($('\n\
            <div class="form-inline form-group form-group-sm">\n\
                <label for="showSeedsInput">Show seeds</label>\n\
            </div>\n\
            ').append($('\
                <select class="form-control" id="showSeedsInput" multiple>\n\
                    <option value="-1">all</option>\n\
                </select>\n\
                ').change(self.showHideTrees))
                );
    };
    
    this.submitControls = function(event) {
        event.preventDefault();
        var level = $(this).find('#levelInput').val();
        var seedID = $(this).find('#seedInput').val();
        if (level >=0 && Math.floor(level) == level && $.isNumeric(level)) {
            if (seedID >= 0) {
                self.collapseTrees(level, seedID);
            } else {
                self.collapseTrees(level);
            }
        }
    };
    
    //show trees based on <select id=showSeedsInput>
    this.showHideTrees = function() {
        //this reference refers to html <select> object
        var seedIDs = $(this).val();
        if (seedIDs) {
            if (seedIDs.indexOf("-1") > -1) {
                self.showAllTrees();
                return;
            }
            var seedGroups = svg.selectAll('svg > g[seedID]');
            seedGroups.each(function(d,i) {
                var currentGroup = d3.select(this);
                currentGroup.classed("hide", seedIDs.indexOf(currentGroup.attr('seedID')) < 0);
            });
        }
    };
    
    this.showAllTrees = function() {
        svg.selectAll('svg > g.hide[seedID]')
                .classed("hide", false);
    };
    
    this.interactionChanged = function(seedID, shapeID, newVal) {
        if (!(seedID in self.trees)) {
            throw "There is not seed with seedID `" + seedID + "` to change interaction.";
        }
        self.trees[seedID].interactionChanged(shapeID, newVal);
    };
    
    self.init();
}

function ForceCollapsibleTree(tree, svg, focus) {
    
    var self = this;
    
    this.publicTree = tree;
    
    //private properties
    var seedID = tree.seedID;
    var root = tree.root;
    var link = null;
    var node = null;
    var force = null;
    
    var width = svg.attr('width');
    var height = svg.attr('height');
    
    //focus for each tree - not all trees in the middle
    //this.focus = focus || {x:width/2, y:height/2};
    
    this.init = function() {
        force = d3.layout.force()
                .size([width, height])
                .gravity(0)
                .charge(function (d) {
                    return d._children ? -Math.sqrt(d.descendatnCount) -5 : -5;
                })
                .linkDistance(function (d) {
                    var nodesRadius = nodeRadius(d.target) + nodeRadius(d.source);
                    var nodesDistance = d.target._children ? 30 : d.target.children ? 15 : 10;
                    return nodesRadius + nodesDistance;
                })
                .linkStrength(.8)
                .on("tick", tick);
        
        var SVGGroup = svg.append("g").attr("seedID", seedID);
        link = SVGGroup.selectAll(".link");
        node = SVGGroup.selectAll(".node");
        
        //root.fixed = true;
        //20% margin ... w*0.2+Math.random()*w*0.6
        //root.x = width * .2 + Math.random() * width * .6;
        //root.y = height * .2 + Math.random() * height * .6;
        
        //set ratio root.x:width and root.y:height to reset root in svg resize
        root.positionRatio = {
            left: root.x / width,
            top: root.y / height
        };
        
        responsiveLayout();
    };
    
    this.remove = function() {
        svg.select('g[seedID="' + seedID + '"]').remove();
    };
    
    this.interactionChanged = function(shapeID, newVal) {
        if (!(shapeID in tree)) {
            throw "There is no shape with shapeID `" + shapeID + "` to change interaction.";
        }
        var nodeWithShapeID = node.filter(function(d) { return d.shapeId === shapeID; });
        
        //find first visible node (not clustered)
        
        
        //.attr('name', null) removes attribute `name` from element
        nodeWithShapeID.attr("picked", newVal ? "yes" : null);
    };
    
    this.hideNodes = function(level) {
        //if there wont be any node.id `id` parameter it should be added before hiding nodes (like previous flatten(root)) which added `id`s to all node
        
        function recurse(node) {
            if (node.children)
                node.children.forEach(recurse);

            if (node.level >= level) {
                if (node.children && (node.children.length > 1 || node.level == level)) {
                    toggle(node);
                }
            }
        }

        recurse(root);
        self.update();
    };

    /**
     * Updates with delay. Then called more times it executes only last delay
     * Optimization for adding nodes in the start/restart of app
     * 
     * @returns {undefined}
     */
    this.timeoutId = 0;
    this.updateWithDelay = function() {
        clearTimeout(self.timeoutId);
        self.timeoutId = setTimeout(self.update, 400);
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

        //descendantCount and leafCount attributes should be updated on existing elements too - they are updated as new shape came
        var allSwitch = node.selectAll("g switch");
        var allForeignObject = allSwitch.select(".foreignObj");
        allForeignObject.select('.descendantCount')
                .text(function (d) {
                    return "Descendant count: " + d.descendatnCount;
                });
        allForeignObject.select('.leafCount')
                .text(function (d) {
                    return "Leaf count: " + d.leafCount;
                });
        
        var foreignObject = switchElem.append("foreignObject")
                //.attr("requiredExtensions", "http://www.w3.org/1999/xhtml") //chrome not working with this attribute
                .attr("class", "foreignObj") //added class due to chrome does not create SVG foreignObject properly - it creates foreignobject and then it could not be selected with "foreignObject" selector - instead use class
                .attr("width", 170)
                .attr("height", "5em")
                .style("transform", function (d) {
                    var radius = nodeRadius(d);
                    return "translate(" + (radius - .3 * radius) + "px, -2em)"; //x=right-30% from radius, y = 1.5em + .5em(padding)
                });

        var bodyElem = foreignObject.append("xhtml:body");
        var containerElem = bodyElem.append("xhtml:div")
                .attr("class", "node-info");

        containerElem.append("xhtml:p")
                .attr("class", "descendantCount")
                .text(function (d) {
                    return "Descendant count: " + d.descendatnCount;
                });
        containerElem.append("xhtml:p")
                .attr("class", "leafCount")
                .text(function (d) {
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
                .style("fill", color)
                .style("stroke", function(d) { return d3.rgb(color(d)).darker(2); });
    };

    function tick() {

        //node.attr("cx", function(d) { return d.x = Math.max(radius, Math.min(width - radius, d.x)); })
        //.attr("cy", function(d) { return d.y = Math.max(radius, Math.min(height - radius, d.y)); });
        /*node.attr("transform", function (d) {
            var radius = nodeRadius(d);
            var cx = Math.max(radius, Math.min(width - radius, d.x));
            var cy = Math.max(radius, Math.min(height - radius, d.y));
            return "translate(" + cx + "," + cy + ")";
        });*/
        node.selectAll("circle").attr("cx", function (d) {
            var radius = nodeRadius(d);
            return d.x = Math.max(radius, Math.min(width - radius, d.x));
        })
                .attr("cy", function (d) {
                    var radius = nodeRadius(d);
                    return d.y = Math.max(radius, Math.min(height - radius, d.y));
                });
        node.selectAll(".foreignObj").attr("x", function (d) {
            var radius = nodeRadius(d);
            return Math.max(radius, Math.min(width - radius, d.x));
        })
                .attr("y", function (d) {
                    var radius = nodeRadius(d);
                    return Math.max(radius, Math.min(height - radius, d.y));
                });
        
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
    }

    // Color leaf nodes orange, and packages white or blue.
    function color(d) {
        return d._children ? "#3182bd" : d.children ? "#c6dbef" : "#fd8d3c";
    }

    // Compute radius for node - used more than 3 - placed in separated function
    function nodeRadius(d) {
        return d.children ? 4.5 : d._children ? Math.sqrt(d.descendatnCount) + 6 : 6;
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
            pickAllChildren(shape);
        }
    }
    
    function pickAllChildren(shape) {
        if (shape.relations.IsLeaf()) {
            shape.interaction.picked(!shape.interaction.picked());
        } else if (shape.relations.children) {
            shape.relations.children.forEach(function(shapeID){
                var childShape = SeedWidgets.Instances()[seedID].GetShape(shapeID);
                if (childShape instanceof ShapeNode) {
                    pickAllChildren(childShape);
                }
            });
        }
    }
    
    function responsiveLayout() {
        $(window).resize(function () {
            width = svg.attr('width');
            height = svg.attr('height');
            
            force.size([width, height]).resume();
            /*root.x = root.positionRatio.left * width;
            root.y = root.positionRatio.top * height;*/
        });
    }
    
    this.init();
}