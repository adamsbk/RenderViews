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
        $(domQuery).html('');
        var root = SeedWidgets.Instances()[0].GetShape(0);
        //self.WriteDirectoryTree(root, '');
        
        console.log(self.buildJson());
    }
    
    self.buildJson = function () {
        var seed = SeedWidgets.Instances()[0];
        var root = SeedWidgets.Instances()[0].GetShape(0);
        
        var rootJSON = {
            "name": "root",
        };
        
        buildJsonRec(root, rootJSON);
        
        function buildJsonRec (node, jsonNode) {
            var childNodes = seed.GetChildrenShapes(node);
            if (childNodes) {
                jsonNode['children'] = [];
                jsonNode = jsonNode['children'];
                for (var i=0; i<childNodes.length; i++) {
                    var newNode = {"name": "child " + i};
                    jsonNode.push(newNode);
                    if (childNodes[i]) { //in case of childNodes is Array [ Object, null ]
                        buildJsonRec(childNodes[i], newNode);
                    }
                }
            }
        }
        
        return rootJSON;
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
    
    return self;
}
