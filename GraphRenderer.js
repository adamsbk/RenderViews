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
        var root = SeedWidgets.Instances()[0].GetShape(0);
        self.WriteDirectoryTree(root, '');
    }
    
    self.WriteDirectoryTree = function (node, spaces) {
        $(domQuery).text(spaces + node.id);
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
