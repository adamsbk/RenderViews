function InteractiveThreeRenderer(domQuery) { //for a whole window call with domQuery "<body>"
    //inherit the base class
    var self = new BasicThreeRenderer(domQuery);

    self.resolveNode = function(mesh)
    {
        var shapeID = mesh.name;
        var seedID = self.Seeds[shapeID];
        var _seed = SeedWidgets.GetById(seedID);
        return {shape: _seed.GetShape(shapeID), seed: _seed};
    }

    //This renderer adds a very basic picking of shapes
    //It sends the results to the shape, which notifies all its subscribers that something has changed.
    //The picking code is based on the following example
    //http://stemkoski.github.io/Three.js/Mouse-Tooltip.html

    //First we need to add a new initialization call wich will be executed after the one of BasicThreeRenderer
    self.initCalls.push(function () { //push the init function to the list of initCalls
        this.projector = new THREE.Projector(); //create a new Projector. It will be used to cast a ray through the scene and get the list of intersections of the ray with shapes 
        document.addEventListener('mousemove', this.onDocumentMouseMove, false); //each time the mouse moves we want to execute our mouse move routine (defined below)
        document.addEventListener('keydown', this.onDocumentKeyDown, false);
        document.addEventListener('keyup', this.onDocumentKeyUp, false);
    });

    self.mouse = { x: 0, y: 0 }; //here we store the last mouse position. The mouse position is stored only when the mouse moves, but the scene is mostly updated with a much higher frequence

    self.onDocumentMouseMove = function onDocumentMouseMove( event ) 
    {
        //Update the mouse position, a transformation from screen to normalized device coordinates is necessary; notice the flipped y
        self.mouse.x = ((event.clientX - self.container.offset().left) / self.container.innerWidth()) * 2 - 1;
        self.mouse.y = -((event.clientY - self.container.offset().top) / self.container.innerHeight()) * 2 + 1;
    }

    self.highlighted = [];
    self.pickingUnlocked = true;

    self.onDocumentKeyDown = function(event)
    {
        if ((self.picked) && (self.pickingUnlocked) && (event.key == "Shift")) {
            self.pickingUnlocked = false;
            var node = self.resolveNode(self.picked);
            node.shape.interaction.visible(false);
            var parent = node.seed.GetParentShape(node.shape);
            if (parent) {
                parent.interaction.visible(true);
                self.highlighted.push(parent);
            }
        }
    }

    self.onDocumentKeyUp = function (event) {
        while (self.highlighted.length > 0) {
            self.highlighted.pop().interaction.visible(false);
        }
        if (!self.pickingUnlocked) {
            var node = self.resolveNode(self.picked);
            node.shape.interaction.visible(true);
            self.pickingUnlocked = true;
        }
    }

    //reference to the mesh being currently picked; null if none
    self.picked = null;
    //material wich substitutes the default mesh material when a mesh is picked
    self.pickedMaterial = new THREE.MeshBasicMaterial({ color: 'red', blending: THREE.NoBlending });

    //At last we add a new update method
    self.updateCalls.push(function () {
        //For an excellent explanation of the following few lines, please refer to
        //http://stackoverflow.com/questions/11036106/three-js-projector-and-ray-objects

        if (this.pickingUnlocked) {
            //First we create a ray passing through the mouse position
            var mousePoint = new THREE.Vector3(this.mouse.x, this.mouse.y, 1); //The mouse point in homogenous coordinates (1 at the end)
            //this.projector.unprojectVector(mousePoint, this.camera); //Unproject the point into the 3D world space
            mousePoint.unproject(this.camera); //Unproject the point into the 3D world space
            var ray = new THREE.Raycaster(this.camera.position, mousePoint.sub(this.camera.position).normalize()); //Ray with origin at the mouse position and direction into the scene passing through the unprojected point

            //Returns an array containing all objects in the scene with which the ray intersects. Result are ordered by increasing distance from the start of the ray.
            var intersects = ray.intersectObjects(this.scene.children);

            ///////// THIS ALTERNATIVE DOES NOT USE THE KNOCKOUT BINDING (and stays here just for educative purposes, please read it first and compare to the approach used below)
            //If any intersection exists
            /*
            if (intersects.length > 0) {
                //If the closest mesh intersected is not the currently stored intersection (i.e. picked) mesh
                if (intersects[0].object != this.picked) {
                    //Restore previous intersection mash (if anything was picked before) to its original material
                    if (this.picked) {
                        this.picked.material = this.picked.defaultMaterial;
                        this.picked.defaultMaterial = null;
                    }
                    //Store reference to closest mesh as current intersection mesh
                    this.picked = intersects[0].object;
                    //Store the material of the closest mesh (for later restoration)
                    this.picked.defaultMaterial = this.picked.material;
                    //Set a new material for closest mesh
                    this.picked.material = this.pickedMaterial;                
                }
            }
            else //There are no intersections
            {
                //Restore previous intersection mesh (if it exists) to its original material
                if (this.picked) {
                    this.picked.material = this.picked.defaultMaterial;
                    this.picked.defaultMaterial = null;
                }
                //Remove previous intersection mesh reference by setting current intersection object to null
                this.picked = null;
            }
            */

            ///////// THIS ALTERNATIVE USES THE KNOCKOUT BINDING        
            if (intersects.length > 0) {
                //If the closest mesh intersected is not the currently stored intersection (i.e. picked) mesh
                if (intersects[0].object != this.picked) {
                    //Restore previous intersection mash (if anything was picked before) to its original material
                    if (this.picked) {
                        var shapeID = this.picked.name;
                        var seedID = this.Seeds[shapeID];
                        var seed = SeedWidgets.GetById(seedID);
                        var shape = seed.GetShape(shapeID);
                        //Use Knockout to unset the picked state of the shape
                        shape.interaction.picked(false);
                    }
                    //Store reference to closest mesh as current intersection mesh
                    this.picked = intersects[0].object;
                    //The same as above but compressed into a single line
                    SeedWidgets.GetById(this.Seeds[this.picked.name]).GetShape(this.picked.name).interaction.picked(true);
                }
            }
            else //There are no intersections
            {
                //Use Knockout to unset the picked state of the shape
                if (this.picked)
                    SeedWidgets.GetById(this.Seeds[this.picked.name]).GetShape(this.picked.name).interaction.picked(false);
                //Remove previous intersection mesh reference by setting current intersection object to null
                this.picked = null;
            }
            /**/
        }
    });

    //////// AS KNOCKOUT IS USED, WE NEED TO SUBSCRIBE TO THE PICKED STATE CHANGES
    self.addCalls.push(function(shape)
    {
        var id = shape.id;
        var pickSubscription = shape.interaction.picked.subscribe(function (newVal) {
            var mesh = this.Meshes[id]; //get the mesh for the shape
            if (mesh) {
                if (newVal) {
                    if (!mesh.defaultMaterial) //if it has no defaultMaterial stored yet, backup the current material
                        mesh.defaultMaterial = mesh.material;
                    mesh.material = this.pickedMaterial; //assign it the picked material
                    //TODO STUDENTS this will not work once selection and highlighting are worging, as the materials would easily overwrite each other.
                }
                else {
                    mesh.material = mesh.defaultMaterial; //if the picking just ended, assign back the default material
                    //TODO STUDENTS this won't work either
                }
            }
        }.bind(self));

        //Add the subscription to the subscriptions map for the given shape, note that again we use an object to possibly store several subscriptions per shape
        if (id in this.ShapeSubscriptions)
            this.ShapeSubscriptions[id].pick = pickSubscription;
        else
            this.ShapeSubscriptions[id] = { pick: pickSubscription };

        //TODO STUDENTS add subscriptions to other shape properties in a similar way
    }
    );

    //The seed subscriptions stored in this.subscriptions are disposed by the AbstractRenderer, so we don't need to take care of them here. No push to removeCalls necessary.
    //But we need to take care of subscriptions to shapes we created above.
    self.removeCalls.push(function (shape) {
        //very similar to RemoveSeedSubscription
        var id = shape.id;
        if (id in this.ShapeSubscriptions) {
            for (t in this.ShapeSubscriptions[id])
                this.ShapeSubscriptions[id][t].dispose();

            delete this.ShapeSubscriptions[id];
        }        
    });

    return self;
}
