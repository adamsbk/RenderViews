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
                        
        var root = SeedWidgets.Instances()[0].GetShape(0);
        self.WriteDirectoryTree(root, '');
        
    });
    
    self.WriteDirectoryTree = function (node, spaces) {
        $(domQuery).text(spaces + node.id);
        var children = node.relations.children;
        for (var i = 0; i < children.length; i++) {
            self.WriteDirectoryTree(SeedWidgets.Instances()[0].GetShape(children[i]), spaces + '__');
        }
    }
    
    return self;
}
