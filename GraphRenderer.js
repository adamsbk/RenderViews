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
                return 1;
            }
            var count = 0;
            for (var i=0; i<node.children.length; i++) {
                count += addDescendantCountProperty(node.children[i]);
            }
            node['descendatnCount'] = count;
            return node.children.length + count;
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
                      .node { cursor: pointer; stroke: #3182bd; stroke-width: 1.5px; }\n\
                      .link { fill: none; stroke: #9ecae1; stroke-width: 1.5px; }\n\
                      </style>");
        $('html > head').append(style);
        
        $(domQuery).width(500);
        $(domQuery).height(500);
        var width = $(domQuery).width(),
            height = $(domQuery).height(),
            root;
        
        var force = d3.layout.force()
        .size([width, height])
        .on("tick", tick);
        
        var svg = d3.select(domQuery).append("svg")
        .attr("width", width)
        .attr("height", height);
        
        var link = svg.selectAll(".link"),
        node = svg.selectAll(".node");
        
        root = self.buildJson();
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
            node = node.data(nodes, function(d) { return d.id; }).style("fill", color);
            
            // Exit any old nodes.
            node.exit().remove();
            
            // Enter any new nodes.
            node.enter().append("circle")
            .attr("class", function(d) { return d.children ? "node" : "node leaf" })
            .attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; })
            .attr("r", function(d) { return d.descendatnCount + 4 || 4.5; })
            .attr("data-shape-id", function(d) {return d.shapeId})
            .attr("data-level", function(d) {return d.level})
            .style("fill", color)
            .on("click", click)
            .call(force.drag);
        }
        
        function tick() {
            link.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });
            
            node.attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });
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
            if (!d3.event.defaultPrevented) {
                toggle(d);
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
