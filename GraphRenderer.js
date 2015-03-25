function GraphRenderer(domQuery) { //for a whole window call with domQuery "<body>"
    //inherit the base class
    var self = AbstractRenderer(domQuery);
    self.initialized = false;
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
        
        //na vypisanie stromu po kliku, pretoze SeedWidgets.Instances()[0] je undefined pri prvom updateCalls
        document.addEventListener('click', this.onDocumentClick, false);
    });
    
    self.onDocumentClick = function onDocumentClick( event ) {
        window.console&&console.log('click bubbled');
        //$(domQuery).html('');
        //var root = SeedWidgets.Instances()[0].GetShape(0);
        //self.WriteDirectoryTree(root, '');
        
        //console.log(self.buildJson());
        self.collapsibleTree();
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
        
        if ($(domQuery).children('svg').length) {
            return;
        }
        
        var style = $("<style>\n\
                      .node circle { cursor: pointer; stroke: #3182bd; stroke-width: 1.5px; }\n\
                      .node text { display: none; }\n\
                      .node:hover text { display: block; }\n\
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
        .charge(function(d) { return d._children ? -d.descendatnCount * 30 : -30; })
        .linkDistance(function(d) { return d.target._children ? 60 : Math.sqrt(d.target.leafCount) * 25; })
        .on("tick", tick);
        
        var svg = d3.select(domQuery).append("svg")
        .attr("width", width)
        .attr("height", height);
        
        var link = svg.selectAll(".link"),
        node = svg.selectAll(".node");
        
        root = self.buildJson();
        
        (function(nodes) {
         function recurse(node) {
         
         if (node.children) node.children.forEach(recurse);
         
         if (node.level >= 3) {
            if (node.children && node.children.length > 1) {
                toggle(node);
                return;
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
            .on("click", click)
            .call(force.drag);
            
            // Enter any new nodes.
            nodeEnter.append("circle")
            .attr("r", function(d) { return d.children ? 4.5 : d._children ? Math.sqrt(d.descendatnCount) * 4.5 : 6; });
            
            //dx and x not worked when tspan x is set
            var texts = nodeEnter.append("text")
            .attr("dy", ".35em")
            .attr("transform", function(d) {
                  var radius = d.children ? 4.5 : d._children ? Math.sqrt(d.descendatnCount) * 4.5 : 6;
                  return "translate(" + radius + ", 0)";
                  });
            
            texts.append("tspan")
            .attr("x", 0)
            .text(function(d) { return "Desc count: " + d.descendatnCount; });
            
            texts.append("tspan")
            .attr("x", 0)
            .attr("y", "1em")
            .text(function(d) { return "Leaf count: " + d.leafCount; });
            
            node.select("circle")
            .transition()
            .attr("r", function(d) { return d.children ? 4.5 : d._children ? Math.sqrt(d.descendatnCount) * 4.5 : 6; })
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
            if (d3.event.defaultPrevented === false) {
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
                
                //if (node.level == 4) {
                //    toggle(node);
                //}
                
                nodes.push(node);
            }
            
            recurse(root);
            return nodes;
        }
    }
    
    //picking
    $(document).on({
        "mouseenter": function() {
            var shape = SeedWidgets.Instances()[0].GetShape($(this).data('shape-id'));
            if (shape) {
                shape.interaction.visible(!shape.interaction.visible());
            }
        },
        "mouseleave": function() {
            var shape = SeedWidgets.Instances()[0].GetShape($(this).data('shape-id'));
            if (shape) {
                shape.interaction.visible(!shape.interaction.visible());
            }
        }
    }, domQuery + " svg .node");
    
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
    
    return self;
}
