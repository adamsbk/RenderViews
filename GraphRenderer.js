/*global d3, SeedWidgets, AbstractRenderer, ShapeNode, ko, Error */

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
        
        self.graphManager = GraphManager.getInstance(domQuery);
        self.graphManager.viewGraph(self.graphManager.graphTypes.ForceCollapsible);
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
        if (id in this.ShapeSubscriptions) {
            for (var t in this.ShapeSubscriptions[id])
                this.ShapeSubscriptions[id][t].dispose();

            delete this.ShapeSubscriptions[id];
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
        if (id in this.ShapeSubscriptions)
            this.ShapeSubscriptions[id].pick = pickSubscription;
        else
            this.ShapeSubscriptions[id] = {pick: pickSubscription};
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
        
        /**
         * structure that holds pointers to self.roots nodes
         * { seed.ID: { shape.id: node in self.roots, ... }, ... }
         */
        var treeNodes = new Object();
        
        var graphTypes = {
            ForceCollapsible: 'ForceCollapsible',
            CirclePacking: 'CirclePacking'
        };

        addToDOM();

        var graphs = {};
        var forceElem = d3.select(domQuery).append("div")
                    .attr('class', 'graph')
                    .attr('id', graphTypes.ForceCollapsible);
        var circleElem = d3.select(domQuery).append("div")
                    .attr('class', 'graph hide')
                    .attr('id', graphTypes.CirclePacking);
        
        graphs[graphTypes.ForceCollapsible] = new ForceCollapsibleForest(forceElem);
        graphs[graphTypes.CirclePacking] = new ZoomableCircleForest(circleElem);
        
        var currentGraph = graphs[graphTypes.ForceCollapsible];
        
        addSwitchButtons();
        
        function addToDOM() {
            /*d3.select(domQuery).append('button')
             .attr('id', 'showInPopup')
             .text('View graph in new window')
             .on('click', self.showInPopup);*/

            console.log(treeNodes);

            addStyles();

            //container for graph controls (inputs for collapsing graph, ...)
            //$(domQuery).append('<div id="graphControls"></div>');
                    
            //addAutoSVGResize();
        }
        
        function addStyles() {
            var style = $("<style>\n\
                      " + domQuery + " .graph { width: 100%; height: 100%; }\n\
                      " + domQuery + " #levelInput { max-width: 50px; }\n\
                      " + domQuery + " .graph svg { overflow: visible; width: 100%; height: 100%; }\n\
                      .node circle { cursor: pointer; /*stroke: #3182bd;*/ stroke-width: 1.5px; }\n\
                      .node[picked=yes] circle { fill: red !important; }\n\
                      .node[pickedHiddenDesc=yes] circle { fill: #ff4d4d !important; }\n\
                      .node text, .node .foreignObj { display: none; }\n\
                      .node:hover text, .node:hover .foreignObj { display: block; }\n\
                      .node .foreignObj body { margin: 0; padding: 0; background-color: transparent; }\n\
                      .node .foreignObj .node-info { background-color: #eee; padding: .5em; border: thin solid #ccc; border-radius: 4px; }\n\
                      .node .foreignObj .node-info p { padding: 0; margin: 0; line-height: 1.2em; font-size: 1em; }\n\
                      .link { fill: none; stroke: #9ecae1; stroke-width: 1.5px; }\n\
                      \n\
                      #CirclePacking .node.leaf {fill: white;}\n\
                      </style>");
            $('html > head').append(style);
        }
        
        function addSwitchButtons() {
            function buttonEvent(event) {
                event.preventDefault();
                if ($('this').hasClass('active')) return;
                
                $(domQuery + ' [data-graph-button].active').removeClass('active');
                $(this).addClass('active');
                instance.viewGraph($(this).data('graph-button'));
            }
            
            var buttons = $('<div class="btn-group"></div>');
            for (var graphKey in graphTypes) {
                if (graphTypes.hasOwnProperty(graphKey)) {
                    buttons.append( $('<a href="#" class="btn btn-default btn-sm '+ (graphTypes[graphKey] === graphTypes['ForceCollapsible'] ? 'active' : '') +'" data-graph-button="'+ graphKey +'">'+ graphTypes[graphKey] +'</a>').click(buttonEvent) );
                }
            }
            $(domQuery).append(buttons);
        }
        
        /*function addAutoSVGResize() {
            $(window).resize(function () {
                if (currentGraph === undefined) return;
                currentGraph.svg
                        .attr("width", $(domQuery).width())
                        .attr("height", $(domQuery).height() - $(domQuery + ' #graphControls').height());
            });
        }*/

        function withEachGraph(callback) {
            for (var graph in graphs) {
                if (graphs.hasOwnProperty(graph)) {
                    callback(graphs[graph]);
                }
            }
        }

        return {
            graphTypes: graphTypes,
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
                    "info": { //added to object due to copy only reference - values (descendantCount,...) are computed later and memory save
                        "ruleId": shape.relations.rule,
                        "level": isRoot ? 0 : seedObject[parent].info.level + 1,
                        "descendantCount": 0,
                        "leafCount": shape.relations.IsLeaf() ? 1 : 0
                    }
                };

                //console.log(shape.id + ' : ' + newNode.id);

                seedObject[shape.id] = newNode;
                if (isRoot) {
                    //roots[seed] = newNode;
                    seedObject.root = newNode;
                    seedObject.seedID = seed;
                    //currentGraph.addTree(seedObject);
                } else if (parent in seedObject) {

                    var currentPredecessor = parent;
                    var isLeaf = shape.relations.IsLeaf();
                    while (currentPredecessor in seedObject) {
                        seedObject[currentPredecessor].info['descendantCount']++;
                        if (isLeaf) {
                            seedObject[currentPredecessor].info['leafCount']++;
                        }
                        currentPredecessor = seedObject[currentPredecessor].parentId;
                    }

                    if (seedObject[parent].children === undefined) {
                        //do not overwrite seedObject[parent] to seedObject.parent because `parent` is numeric
                        seedObject[parent]['children'] = [];
                    }
                    seedObject[parent].children.push(newNode);
                }
                
                withEachGraph(function (graph) {
                    graph.addNode(newNode, seed, isRoot);
                });
                
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
                
                withEachGraph(function (graph) {
                    graph.removeNode(seed, shape.id);
                });
                
                //delete removes only reference so treeNodes[seed].root should keep reference to object if treeNodes[seed][shape.id] === treeNodes[seed].root
                //instead delete could be assigned undefined - faster
                delete treeNodes[seed][shape.id];
                if (treeNodes[seed].root !== undefined && treeNodes[seed].root.id === shape.id) { //if this shape is parent shape
                    console.log("root reference was deleted successfuly");
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
            viewGraph: function(graphName) {
                if (graphs.hasOwnProperty(graphName)) {
                    //currentGraph.svg.classed('hide', true);
                    currentGraph.hide();
                    currentGraph = graphs[graphName];
                    currentGraph.show();
                    //currentGraph.svg.classed('hide', false);
                }
            },
            // Public methods and variables
            publicMethod: function () {
                console.log("The public can see me!");
            },
            publicProperty: "I am also public",
            publicTreeNodes: treeNodes,
            publicCPGraph: graphs[graphTypes.CirclePacking]
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

/**
 * For abstract class to implement abstract methods.
 * Taken from http://stackoverflow.com/questions/783818/how-do-i-create-a-custom-error-in-javascript#answer-871646
 * 
 * @param {type} message
 * @returns {NotImplementedError}
 */
function NotImplementedError(message) {
    this.name = "NotImplementedError";
    this.message = (message || "");
}
NotImplementedError.prototype = Error.prototype;

/**
 * AbstractForest only to emphasize that this methods could be used with any
 * forest (ForceCollapsibleForest, CirclePackingForest)
 * 
 * @param {type} elem
 * @returns {AbstractForest.result}
 */
function AbstractForest(elem) {
    var result = {};
    
    result.elem = elem;
    result.controls = elem.append('div')
            .attr('class', 'graphControls');
    
    result.svg = elem.append('svg');
    
    result.trees = {};
    result.count = 0;
    
    result.addNode = function(node, seedID, isRoot) {
        var createdNode = {
            "id": node.id, //id to match data and DOM nodes -> node.data(nodes, function(d) { return d.id; });
            "name": node.name,
            "shapeId": node.shapeId,
            "parentId": node.parentId,
            "info": node.info
        };
        var tree = isRoot ? {root: createdNode, seedID: seedID} : result.trees[seedID].tree;
        tree[node.shapeId] = createdNode;
        if (isRoot) {
            result.addTree(tree);
        } else if (node.parentId in tree) {
            result.addNodeToParentChildren(createdNode, seedID);
        }
    };
    result.addNodeToParentChildren = function(node, seedID) {
        var parentNode = result.trees[seedID].tree[node.parentId];
        if (parentNode.children === undefined) {
            parentNode.children = [];
        }
        parentNode.children.push(node);
    };
    
    result.removeNode = function (seedID, shapeID) {
        if (result.trees[seedID] === undefined) {
            return; //do not throw exception because removeShape begins by root - so result.trees[seedID] is deleted in the first call
        }
        var tree = result.trees[seedID].tree;
        if (tree[shapeID] === undefined) {
            throw "There is not such a shape to remove";
        }
        //delete removes only reference so treeNodes[seed].root should keep reference to object if treeNodes[seed][shape.id] === treeNodes[seed].root
        //instead delete could be assigned undefined - faster
        delete tree[shapeID];
        if (tree.root !== undefined && tree.root.id === shapeID) { //if this shape is parent shape
            console.log("root reference was deleted successfuly");
            result.removeTree(seedID);
            delete tree.root;
        }
    };
    
    result.addTree = function(tree) {
        throw new NotImplementedError();
    };
    
    result.removeTree = function(seedID) {
        throw new NotImplementedError();
    };
    
    result.addControls = function() {
    };
    
    result.hide = function() {
        result.elem.classed('hide', true);
    };
    
    result.show = function() {
        result.updateEachTree();
        result.elem.classed('hide', false);
        //when element is styled "display:none" its dimensions are 0 (at least in FF) so when visible
        $(window).resize();
    };
    
    result.updateEachTree = function() {
        for (var seedID in result.trees) {
            if (result.trees.hasOwnProperty(seedID)) {
                result.trees[seedID].update(); //update method from ForceCollapsibleTree object
            }
        }
    };

    result.updateBySeedID = function (seedID) {
        if (seedID in result.trees) {
            result.trees[seedID].updateWithDelay();
        } else {
            throw "Tree with seedID `" + seedID + "` was not initialised.";
        }
    };
    
    result.interactionChanged = function(seedID, shapeID, newVal) {
        if (!(seedID in result.trees)) {
            throw "There is not seed with seedID `" + seedID + "` to change interaction.";
        }
        result.trees[seedID].interactionChanged(shapeID, newVal);
    };
    
    //self invoking function - call only once to provide auto svg resize
    (function() {
        $(window).resize(function () {
            var boundingRect = result.elem.node().getBoundingClientRect();
            result.svg
                    .attr("width", boundingRect.width)
                    .attr("height", boundingRect.height - result.controls.node().getBoundingClientRect().height);
        });
        //trigger resize to set initial width and height
        $(window).resize();
    })();
    
    return result;
}

function ForceCollapsibleForest(elem) {
    
    var self = AbstractForest(elem);
    
    self.CLUSTER_MIN_LEVEL = 6;
        
    self.init = function() {
        self.addControls();
    };
    
    //@override
    self.addNodeToParentChildren = function(node, seedID) {
        var parentNode = self.trees[seedID].tree[node.parentId];        
        
        if (parentNode.children === undefined) {
            parentNode.children = [];
        }
        
        //push item into children or clustered _children
        //if (parentNode.children) - checks whether children object exists ([] is true) ... if (parentNode.children == false) tests (parentNode.children.toString) which returns "" and "" == false
        if (parentNode.children) {
            parentNode.children.push(node);
        } else if ('_children' in parentNode) {
            parentNode._children.push(node);
        }

        //start clustering at certain level
        if (parentNode.info.level >= self.CLUSTER_MIN_LEVEL) {
            if (parentNode.children && (parentNode.info.level == self.CLUSTER_MIN_LEVEL || parentNode.children.length > 1)) {
                parentNode._children = parentNode.children;
                parentNode.children = null;
            }
        }
    };
    
    self.addTree = function(tree) {   
        self.count++;
        self.trees[tree.seedID] = new ForceCollapsibleTree(tree, self.svg);
        $('#seedInput, #showSeedsInput').append('<option value="'+ tree.seedID +'">Seed #'+ tree.seedID +'</option>');
    };
    
    self.removeTree = function(seedID) {
        if (!(seedID in self.trees)) {
            throw "There does not exist tree with property " + seedID + " in ForceCollapsible.trees object";
        }
        $('#seedInput, #showSeedsInput').children('option[value="'+ seedID +'"]').remove();
        
        self.trees[seedID].remove();
        delete self.trees[seedID];
        self.count--;
    };
    
    self.collapseTrees = function(level, seedID) {
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
    
    self.addControls = function() {
        $(self.controls[0]).append($('\n\
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
        
        $(self.controls[0]).append($('\n\
            <div class="form-inline form-group form-group-sm">\n\
                <label for="showSeedsInput">Visible</label>\n\
            </div>\n\
            ').append($('\
                <select class="form-control" id="showSeedsInput" multiple>\n\
                    <option value="-1">all</option>\n\
                </select>\n\
                ').change(self.showHideTrees))
                );
    };
    
    self.submitControls = function(event) {
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
    self.showHideTrees = function() {
        //this reference refers to html <select> object
        var seedIDs = $(this).val();
        if (seedIDs) {
            if (seedIDs.indexOf("-1") > -1) {
                self.showAllTrees();
                return;
            }
            var seedGroups = self.svg.selectAll('svg > g[seedID]');
            seedGroups.each(function(d,i) {
                var currentGroup = d3.select(this);
                currentGroup.classed("hide", seedIDs.indexOf(currentGroup.attr('seedID')) < 0);
            });
        }
    };
    
    self.showAllTrees = function() {
        self.svg.selectAll('svg > g.hide[seedID]')
                .classed("hide", false);
    };
    
    self.init();
    
    return self;
}

function ForceCollapsibleTree(tree, svg/*, focus*/) {
    
    var self = this;
    
    this.tree = tree;
    
    //private properties
    var seedID = tree.seedID;
    var SVGGroup = null;
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
                    return d._children ? -Math.sqrt(d.info.descendantCount) -30 : -30;
                })
                .chargeDistance(100)
                .linkDistance(function (d) {
                    var nodesRadius = nodeRadius(d.target) + nodeRadius(d.source);
                    var nodesDistance = d.target._children ? 30 : d.target.children ? 15 : 10;
                    return nodesRadius + nodesDistance;
                })
                .linkStrength(.95)
                .on("tick", tick);
        
        SVGGroup = svg.append("g").attr("seedID", seedID);
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
        SVGGroup.remove();
    };
    
    this.interactionChanged = function(shapeID, newVal) {
        if (!(shapeID in tree)) {
            throw "There is no shape with shapeID `" + shapeID + "` to change interaction.";
        }
        var nodeWithShapeID = node.filter(function(d) { return d.shapeId === shapeID; });
        
        if (!nodeWithShapeID.empty()) {
            //.attr('name', null) removes attribute `name` from element
            nodeWithShapeID.attr("picked", newVal ? "yes" : null);
        } else if (newVal) {
            //find first visible node (not clustered)
            var parentId = tree[shapeID].parentId;
            while ((parentId in tree) && nodeWithShapeID.empty()) {
                nodeWithShapeID = node.filter(function(d) { return d.shapeId === parentId; });
                parentId = tree[parentId].parentId;
            }
            nodeWithShapeID.attr("pickedHiddenDesc", "yes");
        }
        if (!newVal) {
            node.filter('[pickedHiddenDesc=yes]').attr("pickedHiddenDesc", null);
        }
    };
    
    this.hideNodes = function(level) {
        //if there wont be any node.id `id` parameter it should be added before hiding nodes (like previous flatten(root)) which added `id`s to all node
        
        function recurse(node) {
            //hide also descendants of node._children when user collapsed it (descendants may not be collapsed)
            var nodeChildren = node.children ? node.children : node._children ? node._children : false;
            if (nodeChildren)
                nodeChildren.forEach(recurse);

            if (node.info.level >= level) {
                if (node.children && (node.children.length > 1 || node.info.level == level)) {
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
                    return d.info.level;
                })
                .call(force.drag);

        // Enter any new nodes.
        nodeEnter.append("circle")
                .attr("r", nodeRadius)
                .on("click", click)
                .on("mouseenter", nodeMouseOver)
                .on("mouseleave", nodeMouseOver);
        
        //for root only
        //nodeEnter.append("text")
        //        .attr("dx", -20)
        //        .text("Seed " + seedID);

        //add texts to nodes - try <foreignobject> and then <text> with tspan
        //dx and x not worked when tspan x is set
        var switchElem = nodeEnter.append("switch");

        //descendantCount and leafCount attributes should be updated on existing elements too - they are updated as new shape came
        var allSwitch = node.selectAll("g switch");
        var allForeignObject = allSwitch.select(".foreignObj");
        allForeignObject.select('.descendantCount')
                .text(function (d) {
                    return "Descendant count: " + d.info.descendantCount;
                });
        allForeignObject.select('.leafCount')
                .text(function (d) {
                    return "Leaf count: " + d.info.leafCount;
                });
        
        var foreignObject = switchElem.append("foreignObject")
                //.attr("requiredExtensions", "http://www.w3.org/1999/xhtml") //chrome not working with this attribute
                .attr("class", "foreignObj") //added class due to chrome does not create SVG foreignObject properly - it creates foreignobject and then it could not be selected with "foreignObject" selector - instead use class
                .attr("width", 170)
                .attr("height", "6em")
                .style("transform", function (d) {
                    var radius = nodeRadius(d);
                    return "translate(" + (radius - .3 * radius) + "px, -3em)"; //x=right-30% from radius, y = 1.5em + .5em(padding)
                });

        var bodyElem = foreignObject.append("xhtml:body");
        var containerElem = bodyElem.append("xhtml:div")
                .attr("class", "node-info");

        containerElem.append("xhtml:p")
                .attr("class", "descendantCount")
                .text(function (d) {
                    return "Descendant count: " + d.info.descendantCount;
                });
        containerElem.append("xhtml:p")
                .attr("class", "leafCount")
                .text(function (d) {
                    return "Leaf count: " + d.info.leafCount;
                });
        containerElem.append("xhtml:p").text(function (d) {
            return "Level: " + d.info.level;
        });
        containerElem.append("xhtml:p").text(function (d) {
            return d.index === root.index ? "Seed #" + seedID : "Created by rule #" + d.info.ruleId;
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
                    return "Descendant count: " + d.info.descendantCount;
                });

        texts.append("tspan")
                .attr("x", 0)
                .attr("y", "1em")
                .text(function (d) {
                    return "Leaf count: " + d.info.leafCount;
                });

        texts.append("tspan")
                .attr("x", 0)
                .attr("y", "2em")
                .text(function (d) {
                    return "Level: " + d.info.level;
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

    // Color leaf nodes dark yellow, root brown, nodes light blue, collapsed nodes dark blue
    function color(d) {
        return d._children ? "#3182bd" : d.index === root.index ? "#7E3817" : d.children ? "#c6dbef" : "#fd8d3c";
    }

    // Compute radius for node - used more than 3 - placed in separated function
    function nodeRadius(d) {
        return d._children ? Math.sqrt(d.info.descendantCount) + 6 : d.index === root.index ? 12 : d.children ? 4.5 : 6;
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

function ZoomableCircleForest(elem) {
    
    var self = AbstractForest(elem);
            
    self.init = function() {
        self.addControls();
    };
    
    self.addTree = function(tree) {   
        self.trees[tree.seedID] = new ZoomableCirclePacking(tree, self.svg);
        $('#treeBySeed').append('<option value="'+ tree.seedID +'" '+ (self.count===0 ? 'selected':'') +'>Seed #'+ tree.seedID +'</option>');
        if (self.count === 0) {
            $('#treeBySeed').change();
        }
        self.count++;
    };
    
    self.removeTree = function(seedID) {
        if (!(seedID in self.trees)) {
            throw "There does not exist tree with property " + seedID + " in ForceCollapsible.trees object";
        }
        $('#treeBySeed').children('option[value="'+ seedID +'"]').remove();
        
        self.trees[seedID].remove();
        delete self.trees[seedID];
        self.count--;
    };
    
    self.addControls = function() {
        //self.controls is created by d3 so self.controls[0] returns element for jquery
        $(self.controls[0]).append($('\n\
            <div class="form-inline form-group form-group-sm">\n\
              <label for="treeBySeed">Show tree</label>\n\
            </div>\n\
            ').append($('\n\
                <select class="form-control" id="treeBySeed">\n\
                </select>\n\
                ').change(function () {
            self.svg.selectAll('g[seedID]:not(.hide)')
                    .classed('hide', true);
            self.svg.select('g[seedID="'+ $(this).val() +'"]')
                    .classed('hide', false);
        })));
    };
    
    self.init();
    
    return self;
    
}

function ZoomableCirclePacking(tree, svg) {
    
    var self = this;
    
    this.tree = tree;
    
    var seedID = tree.seedID;
    var color = null;
    var pack = null;
    var root = tree.root;
    var focus = root;
    var nodes = null;
    var node = null;
    var circle = null;
    var text = null;
    var view = null;
    var SVGGroup = null;
    
    var width = 300;//svg.attr('width');
    var height = 300;//svg.attr('height');

    this.init = function() {
        color = d3.scale.linear()
                .domain([-1, 5])
                .range(["hsl(152,80%,80%)", "hsl(228,30%,40%)"])
                .interpolate(d3.interpolateHcl);
        
        pack = d3.layout.pack()
                .padding(2)
                .size([width, height])
                .value(function(d) { return 1000/*d.info.descendantCount*/; });
        
        SVGGroup = svg.append('g')
                .attr('seedID', tree.seedID)
                .attr('class', 'hide')
                .attr('transform', "translate(" + width/2 + "," +height/2+ ")");
        
        SVGGroup.style("background", color(-1))
                .on("click", function () {
                    zoom(root);
                });
        
        circle = SVGGroup.selectAll('circle');
        text = SVGGroup.selectAll('text');
        node = SVGGroup.selectAll('circle,text');
        
    };
    
    this.remove = function() {
        //SVGGroup == svg.select('g[seedID="' + seedID + '"]')
        SVGGroup.remove();
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
    
    this.update = function() {
        nodes = pack.nodes(root);
        
        circle = SVGGroup
                .selectAll("circle")
                .data(nodes)
                .enter().append('circle')
                .attr('class', function(d) { return d.children ? "node" : "node leaf"; })
                .style('fill', function(d) { return d.children ? color(d.depth) : null; })
                .on('click', function(d) { if (focus !== d) zoom(d), d3.event.stopPropagation(); })
                .on("mouseenter", nodeMouseOver)
                .on("mouseleave", nodeMouseOver);
        
        text = SVGGroup.selectAll('text')
                .data(nodes)
                .enter().append('text')
                .attr('class', 'label')
                .style('fill-opacity', function (d) {
                    return d.parent === root ? 1 : 0;
                })
                .style('display', function (d) {
                    return d.parent === root ? null : 'none';
                })
                .text(function (d) {
                    return 'Desc cnt: ' + d.info.descendantCount;
                });
        
        node = SVGGroup.selectAll('circle,text');
        
        //zoomTo([root.x, root.y, root.r*2]);
    };
    
    function zoom(d) {
        var focus0 = focus;
        focus = d;

        var transition = d3.transition()
                .duration(d3.event.altKey ? 7500 : 750)
                .tween("zoom", function (d) {
                    var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
                    return function (t) {
                        zoomTo(i(t));
                    };
                });

        transition.selectAll("text")
                .filter(function (d) {
                    return d.parent === focus || this.style.display === "inline";
                })
                .style("fill-opacity", function (d) {
                    return d.parent === focus ? 1 : 0;
                })
                .each("start", function (d) {
                    if (d.parent === focus)
                        this.style.display = "inline";
                })
                .each("end", function (d) {
                    if (d.parent !== focus)
                        this.style.display = "none";
                });
    }

    function zoomTo(v) {
        var k = width / v[2];
        view = v;
        node.attr("transform", function (d) {
            return "translate(" + (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")";
        });
        circle.attr("r", function (d) {
            return d.r * k;
        });
    }
    
    this.interactionChanged = function(shapeID, newVal) {
        if (!(shapeID in tree)) {
            throw "There is no shape with shapeID `" + shapeID + "` to change interaction.";
        }
        var nodeWithShapeID = node.filter(function(d) { return d.shapeId === shapeID; });        
        
        //.attr('name', null) removes attribute `name` from element
        nodeWithShapeID.attr("picked", newVal ? "yes" : null);
    };
    
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
    
    this.init();
}