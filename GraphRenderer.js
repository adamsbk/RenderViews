function GraphRenderer(domQuery) { //for a whole window call with domQuery "<body>"
    //inherit the base class
    var self = AbstractRenderer(domQuery);
    self.initialized = false;
    
    self.popupWindow = null;
    
    self.root = null;
    self.treeNodes = new Object(); //to access self.root nodes in O(1) ... self.treeNodes[shape.id] = reference to node in self.root
    
    self.IsInitialized = function () {
        if (!self.initialized) {
            self.initialized = true;
            return false;
        }
        else
            return true;
    }
    
    self.initCalls.push(function () {
        window.console&&console.log('Just loaded');
        $(domQuery).text("Just loaded the graph renderer.");
        
        //add button to draw D3 graph
        $(domQuery).append(
            $('<button id="drawGraph">Draw graph</button>').click(function(){
                self.collapsibleTree();
            })
        );
    });
    
    self.showInPopup = function () {
        if (self.popupWindow !== null && !self.popupWindow.closed) {
            return;
        }
        self.popupWindow = window.open("", "", "width="+ $(domQuery).width() +", height="+ $(domQuery).height() +", resizable=yes, menubar=yes, status=yes");
        if (!self.popupWindow) {
            alert("It seems that your browser has not allowed popup windows for this domain.");
            return;
        }
        var newDomQuery = self.popupWindow.document.body;
        $(newDomQuery).html($(domQuery).clone(true));
        domQuery = newDomQuery;
    }
    
    self.buildJson = function () {
        
        var seed = SeedWidgets.Instances()[0];
        
        function buildJsonRec (node, jsonNode, level) {
            if (node.relations.IsLeaf()) {
                return;
            }
            var childNodes = seed.GetChildrenShapes(node);
            
            //create new property children and assign it to current jsonNode
            jsonNode['children'] = [];
            jsonNode = jsonNode['children'];
            for (var i=0; i<childNodes.length; i++) {
                if (childNodes[i] instanceof ShapeNode) { //in case of childNodes is Array [ Object, null ]
                    var newNode = {
                        "name": "child " + i,
                        "shapeId": childNodes[i].id,
                        "level": level
                    };
                    jsonNode.push(newNode);
                    buildJsonRec(childNodes[i], newNode, level+1);
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
            for (var i=0; i<node.children.length; i++) {
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
    }
    
    self.collapsibleTree = function () {
        
        if ($(domQuery).children('svg').length || SeedWidgets.Instances().length == 0) {
            return;
        }
        /*d3.select(domQuery).append('button')
        .attr('id', 'showInPopup')
        .text('View graph in new window')
        .on('click', self.showInPopup);*/
        
        var style = $("<style>\n\
                      " + domQuery + " > svg { overflow: visible; }\n\
                      .node circle { cursor: pointer; stroke: #3182bd; stroke-width: 1.5px; }\n\
                      .node text, .node foreignObject { display: none; }\n\
                      .node:hover text, .node:hover foreignObject { display: block; }\n\
                      .node foreignObject body { margin: 0; padding: 0; background-color: transparent; }\n\
                      .node foreignObject .node-info { background-color: #eee; padding: .5em; border: thin solid #ccc; border-radius: 4px; }\n\
                      .node foreignObject .node-info p { padding: 0; margin: 0; }\n\
                      .link { fill: none; stroke: #9ecae1; stroke-width: 1.5px; }\n\
                      </style>");
        $('html > head').append(style);
        
        $(domQuery).width(720);
        $(domQuery).height(600);
        var width = $(domQuery).width(),
            height = $(domQuery).height(),
            root;
        
        var force = d3.layout.force()
        .size([width, height])
        .gravity(.01)
        .charge(function(d) { return d._children ? -d.leafCount * 15 : -30; })
        .linkDistance(function(d) {
                      var nodesRadius = nodeRadius(d.target) + nodeRadius(d.source);
                      var nodesDistance = d.target._children ? 60 : d.target.children ? 25 : 15;
                      return nodesRadius + nodesDistance;
                      })
        .on("tick", tick);
        
        var svg = d3.select(domQuery).append("svg")
        .attr("width", width)
        .attr("height", height);
        
        var link = svg.selectAll(".link"),
        node = svg.selectAll(".node");
        
        root = self.buildJson();
        
        //set root fixed
        root.fixed = true;
        root.x = width / 2;
        root.y = height / 2;
        
        flatten(root); //it is important to add `id` attribute to nodes before clustering !!!
        (function(nodes) {
         function recurse(node) {
         
         if (node.children) node.children.forEach(recurse);
         
         if (node.level >= 3) {
            if (node.children && node.children.length > 1) {
                console.log("toggled level " + node.level);
                toggle(node);
            }
         }
         }
         
         recurse(nodes);
         })(root);
        
        update();
        
        function update() {
            var nodes = flatten(root),
            links = d3.layout.tree().links(nodes);
            
            // Restart the force layout.
            force
            .nodes(nodes)
            .links(links)
            .start();
            
            // Update the links…
            link = link.data(links, function(d) { return d.target.id; });
            
            // Exit any old links.
            link.exit().remove();
            
            // Enter any new links.
            link.enter().insert("line", ".node")
            .attr("class", "link")
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });
            
            // Update the nodes…
            node = node.data(nodes, function(d) { return d.id; });
            
            // Exit any old nodes.
            node.exit().remove();
            
            var nodeEnter = node.enter().append("g")
            .attr("class", function(d) { return d.children ? "node" : "node leaf" })
            .attr("data-shape-id", function(d) {return d.shapeId})
            .attr("data-level", function(d) {return d.level})
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
            .style("transform", function(d) {
                  var radius = nodeRadius(d);
                  return "translate(" + (radius - .3*radius) + "px, -2em)"; //x=right-30% from radius, y = 1.5em + .5em(padding)
                  });
            
            var bodyElem = foreignObject.append("xhtml:body");
            var containerElem = bodyElem.append("xhtml:div")
            .attr("class", "node-info");
            
            containerElem.append("xhtml:p").text(function(d) { return "Descendant count: "+d.descendatnCount; });
            containerElem.append("xhtml:p").text(function(d) { return "Leaf count: "+d.leafCount; });
            containerElem.append("xhtml:p").text(function(d) { return "Level: "+d.level; });
            
            var texts = switchElem.append("text")
            .style("transform", function(d) {
                  var radius = nodeRadius(d);
                  return "translate(" + (radius) + "px, 0)";
                  });
            
            texts.append("tspan")
            .attr("x", 0)
            .attr("y", 0)
            .text(function(d) { return "Descendant count: " + d.descendatnCount; });
            
            texts.append("tspan")
            .attr("x", 0)
            .attr("y", "1em")
            .text(function(d) { return "Leaf count: " + d.leafCount; });
            
            texts.append("tspan")
            .attr("x", 0)
            .attr("y", "2em")
            .text(function(d) { return "Level: " + d.level; });
            
            node.select("circle")
            .transition()
            .attr("r", nodeRadius)
            .style("fill", color);
        }
        
        function tick() {
            link.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });
            
            //node.attr("cx", function(d) { return d.x; })
            //.attr("cy", function(d) { return d.y; });
            node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
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
                if (node.children) node.children.forEach(recurse);
                if (!node.id) node.id = ++i;
                
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
    
    self.WriteDirectoryTree = function (node, spaces) {
        if (!node) {
            return;
        }
        $(domQuery).append(spaces + node.id + '<br>');
        if (node.relations.IsLeaf()) {
            return;
        }
        var children = node.relations.children;
        for (var i = 0; i < children.length; i++) {
            self.WriteDirectoryTree(SeedWidgets.Instances()[0].GetShape(children[i]), spaces + '__');
        }
    }
    
    
    self.addCalls.push(function(shape) {
        console.log(shape);
        
        /*var seed = shape.relations.seed;
        var parent = shape.relations.parent;
        
        if (self.treeNodes[seed] === undefined) {
            self.treeNodes[seed] = new Object();
        }
        
        var seedObject = self.treeNodes[seed];
        seedObject[shape.id] = shape;
        
        if (parent in seedObject) {
            if (seedObject[parent].children === undefined) {
                seedObject[parent]['children'] = [];
            }
            seedObject[parent]children.push(shape);
        }*/
    });
    
    return self;
}
