var BVH = { REVISION:'0.1a'};

BVH.TO_RAD = Math.PI / 180;
window.URL = window.URL || window.webkitURL;

BVH.Reader = function(){
	this.debug = true;
	this.type = "";
	this.data = null;
	this.root = null;
	this.numFrames = 0;
	this.secsPerFrame = 0;
	this.play = false;
	this.channels = null;
	this.lines = "";
	
	this.speed = 1;

	this.nodes = null;
	this.order = {};

	this.ParentNodes = null;
	this.ChildNodes = null;
	this.BoneByName = null;
	this.Nodes = null;

	
	this.frame = 0;
	this.oldFrame = 0;
	this.startTime = 0;
	
	this.position = new THREE.Vector3( 0, 0, 0 );
	this.scale = 1;

	this.tmpOrder = "";
	this.tmpAngle = [];

	this.skeleton = null;
	this.bones = [];
	this.nodesMesh = [];
	this.boneSize = 1.5;

	this.endFunction = null;

	// geometry
	this.boxgeo = new THREE.BufferGeometry().fromGeometry( new THREE.BoxGeometry( 1.5, 1.5, 1 ) );
    this.boxgeo.applyMatrix( new THREE.Matrix4().makeTranslation( 0, 0, 0.5 ) );

    this.nodegeo = new THREE.BufferGeometry().fromGeometry( new THREE.SphereGeometry ( 1, 8, 6 ) );

	// material
    this.boneMaterial = new THREE.MeshBasicMaterial({ color:0xffff44 });
    this.nodeMaterial = new THREE.MeshBasicMaterial({ color:0x88ff88 });
}

BVH.Reader.prototype = {
    constructor: BVH.Reader,

    load:function(fname){
    	this.type = fname.substring(fname.length-3,fname.length);
    	var _this = this;
			
		if(this.type === 'bvh'){// direct from file
			var xhr = new XMLHttpRequest();
		    xhr.open( 'GET', fname, true );
			xhr.onreadystatechange = function(){ if ( this.readyState == 4 ){ _this.parseData(this.responseText.split(/\s+/g));}};
			xhr.send( null );
	    } else if(this.type === 'png'){// from png link
	    	var trans = new Transcode.Load(fname, function(string) { _this.parseData(string.split(/\s+/g))} );
		}
    },
    parseData:function(data){
    	//console.log('inparsing')
    	this.data = data;
		this.channels = [];
		this.nodes = [];
		this.Nodes = {};
		this.distances = {};

		this.ParentNodes = {};
		this.ChildNodes = {};
		this.BoneByName = {};
		var done = false;
		while (!done) {
			switch (this.data.shift()) {
			case 'ROOT':
			    if(this.root !== null) this.clearNode();
			    if(this.skeleton !== null) this.clearSkeleton();

				this.root = this.parseNode(this.data);
				this.root.position.copy(this.position);
				this.root.scale.set(this.scale,this.scale,this.scale);

				break;
			case 'MOTION':
				this.data.shift();
				this.numFrames = parseInt( this.data.shift() );
				this.data.shift();
				this.data.shift();
				this.secsPerFrame = parseFloat(this.data.shift());
				done = true;
			}
		}

		debugTell("BVH frame:"+this.numFrames+" s/f:"+this.secsPerFrame + " channels:"+this.channels.length + " node:"+ this.nodes.length);
		this.getDistanceList();
		this.getNodeList();

		if(this.debug) this.addSkeleton();

		this.startTime = Date.now();
		this.play = true;
    },
    reScale:function (s) {
    	this.scale = s;
    	if(this.root)this.root.scale.set(this.scale,this.scale,this.scale);
    },
    rePosition:function (v) {
    	this.position = v;
    	this.root.position.copy(this.position);
    },
    getDistanceList:function () {
    	this.distances = {};
    	var n = this.nodes.length, node, name;
    	while (n--){
    		node = this.nodes[n];
    		name = node.name;
    		if(node.children.length){
    			this.distances[name] = BVH.DistanceTest(new THREE.Vector3().setFromMatrixPosition( node.matrixWorld ), node.children[0].position);
    		} else this.distances[name] = 2;
    	}
    },
    getNodeList:function () {
    	var n = this.nodes.length, node, s = "", name, p1,p2;
    	for(var i=0; i<n; i++){
    		node = this.nodes[i];
    		name = node.name;

    		this.Nodes[name] = node;
    		if(node.parent){ 
    			this.ParentNodes[name] = node.parent; 
    		} else this.ParentNodes[name] = null;
		    if(node.children.length){
		    	//p1 = new THREE.Vector3().setFromMatrixPosition( node.matrixWorld )
		    	//p2 = node.children[0].position;
		    	//this.distances[name] = BVH.DistanceTest(p1, p2);
		    	this.ChildNodes[name] = node.children[0]; 
		    } else{
		        this.ChildNodes[name] = null; 
		        //this.distances[name] = 2;
		    }
            
    		s += node.name + " _ "+ i +"<br>"//+" _ "+node.parent.name +" _ "+node.children[0].name+"<br>";
    	}

    	//console.log(this.distances)
    	if(out2)out2.innerHTML = s;
    	if(this.endFunction!== null)this.endFunction();
    },
    showHideSkeleton:function (b) {
    	if(b) this.skeleton.visible = true;
    	else this.skeleton.visible = false;
    },
    addSkeleton:function () {
    	this.skeleton = new THREE.Group();
    	this.bones = [];
    	this.nodesMesh = [];

    	var n = this.nodes.length, node, bone;

    	for(var i=0; i<n; i++){
    		node = this.nodes[i];

    		this.nodesMesh[i] = new THREE.Mesh( this.nodegeo, this.nodeMaterial  )
    		this.skeleton.add(this.nodesMesh[i]);

    		if ( node.name !== 'Site' ){
    			bone = new THREE.Mesh( this.boxgeo, this.boneMaterial);
    			bone.castShadow = true;
                bone.receiveShadow = true;
    			bone.rotation.order = 'XYZ';
	    		bone.name = node.name;
	    		this.skeleton.add(bone);
	    		this.bones[i] = bone;
	    		this.BoneByName[node.name]= bone;
    	    }
    	}
    	scene.add( this.skeleton );
    },
    clearSkeleton:function () {
    	var n = this.skeleton.children.length;
    	while(n--){
    		this.skeleton.remove(this.skeleton.children[n]);
    	}
    	scene.remove( this.skeleton );
    	this.skeleton = null;
    },
    updateSkeleton:function (  ) {
    	var mtx, node, bone, name;
    	var n = this.nodes.length;
    	var target;
    	for(var i=0; i<n; i++){
    		node = this.nodes[i];
    		bone = this.bones[i];
    		name = node.name;

    		mtx = node.matrixWorld;

    		this.nodesMesh[i].position.setFromMatrixPosition( mtx );

    		if ( name !== 'Site' ){
	    		
	    		bone.position.setFromMatrixPosition( mtx );
	    		//this.skeletonBones[i].rotation.setFromRotationMatrix( mtx );
	    		if(node.children.length){
	    			target = new THREE.Vector3().setFromMatrixPosition( node.children[0].matrixWorld );
	    			bone.lookAt(target);
	    			bone.rotation.z = 0;

	    			//if(bone.name==="Head")bone.scale.set(this.boneSize*2,this.boneSize*2,BVH.DistanceTest(bone.position, target)*(this.boneSize*1.3));
	    			//else bone.scale.set(this.boneSize,this.boneSize,BVH.DistanceTest(bone.position, target));
	    			if(name=="Head")bone.scale.set(this.boneSize*2,this.boneSize*2,this.distances[name]*(this.boneSize*1.3));
	    			else bone.scale.set(this.boneSize,this.boneSize,this.distances[name]);
	    		}
	    		/*if(node.parent){
	    			target = new THREE.Vector3().setFromMatrixPosition( node.parent.matrixWorld );
	    			this.skeletonBones[i].lookAt(target);
	    		}*/
	    	}
    	}
    },
	transposeName:function(name){
		if(name==="hip" || name==="SpineBase") name = "Hips";
		if(name==="abdomen" || name==="SpineBase2") name = "Spine1";
		if(name==="chest" || name==="SpineMid") name = "Chest";
		if(name==="neck" || name==="Neck2") name = "Neck";
		if(name==="head") name = "Head";
		if(name==="lCollar") name = "LeftCollar";
		if(name==="rCollar") name = "RightCollar";
		if(name==="lShldr") name = "LeftUpArm";
		if(name==="rShldr") name = "RightUpArm";
		if(name==="lForeArm") name = "LeftLowArm";
		if(name==="rForeArm") name = "RightLowArm";
		if(name==="lHand") name = "LeftHand";
		if(name==="rHand") name = "RightHand";
		if(name==="lFoot") name = "LeftFoot";
		if(name==="rFoot") name = "RightFoot";
		if(name==="lThigh") name = "LeftUpLeg";
		if(name==="rThigh") name = "RightUpLeg";
		if(name==="lShin") name = "LeftLowLeg";
		if(name==="rShin") name = "RightLowLeg";

		// leg
		if(name==="RightHip" || name==="HipRight") name = "RightUpLeg";
		if(name==="LeftHip" || name==="HipLeft") name = "LeftUpLeg";
		if(name==="RightKnee" || name==="KneeRight") name = "RightLowLeg";
		if(name==="LeftKnee" || name==="KneeLeft") name = "LeftLowLeg";
		if(name==="RightAnkle" || name==="AnkleRight") name = "RightFoot";
		if(name==="LeftAnkle" || name==="AnkleLeft") name = "LeftFoot";
		// arm
		if(name==="RightShoulder" || name==="ShoulderRight") name = "RightUpArm";
		if(name==="LeftShoulder" || name==="ShoulderLeft") name = "LeftUpArm";
		if(name==="RightElbow" || name==="ElbowRight") name = "RightLowArm";
		if(name==="LeftElbow" || name==="ElBowLeft") name = "LeftLowArm";
		if(name==="RightWrist" || name==="WristRight") name = "RightHand";
		if(name==="LeftWrist"|| name==="WristLeft") name = "LeftHand";

		if(name==="rcollar" || name==="CollarRight") name = "RightCollar";
		if(name==="lcollar" || name==="CollarLeft") name = "LeftCollar";

		if(name==="rtoes") name = "RightToe";
		if(name==="ltoes") name = "LeftToe";

		if(name==="upperback") name = "Spine1";
		
		return name;
	},
    parseNode:function(data){
    	var name, done, n, node, t;
		name = data.shift();
		name = this.transposeName(name);
		node = new THREE.Group();


		//node = new THREE.Mesh( this.nodegeo, this.nodeMaterial  )
		//node.add(b);
		node.name = name;

		done = false;
		while ( !done ) {
			switch ( t = data.shift()) {
				case 'OFFSET':
					node.position.set( parseFloat( data.shift() ), parseFloat( data.shift() ), parseFloat( data.shift() ) );
					node.offset = node.position.clone();
					break;
				case 'CHANNELS':
					n = parseInt( data.shift() );
					for ( var i = 0;  0 <= n ? i < n : i > n;  0 <= n ? i++ : i-- ) { 
						this.channels.push({ node: node, prop: data.shift() });
					}
					break;
				case 'JOINT':
				case 'End':
					node.add( this.parseNode(data) );
					break;
				case '}':
					done = true;
			}
		}
		//
		this.nodes.push(node);
		//console.log(name);

		//this.Nodes[node.name] = node;
		   // if(node.parent){this.ParentNodes[node.name] = node.parent.name; console.log('pp')}
		   // else this.ParentNodes[node.name] = null;

		//if(name == 'Hips') scene.add( node );

		return node;
    },
    clearNode:function(){
    	//console.log('clear');
    	var i;
    	if(out2)out2.innerHTML = "";

    	if(this.nodes){

	    	for (i=0; i<this.nodes.length; i++){
				this.nodes[i] = null;
			}
			this.nodes.length = 0;

			/*if(this.bones.length > 0){
		    	for ( i=0; i<this.bones.length; i++){
					if(this.bones[i]){
						this.bones[i].geometry.dispose();
					}
				}
				this.bones.length = 0;
		        scene.remove( this.skeleton );
		   }*/
		}
    },
    animate:function(){
    	//debugTell("frame" +  this.frame);
    	var ch;
		var n =  this.frame % this.numFrames * this.channels.length;
		var ref = this.channels;
		var isRoot = false;

		for ( var i = 0, len = ref.length; i < len; i++) {
			ch = ref[ i ];
			if(ch.node.name === "Hips") isRoot = true;
			else isRoot = false;


			switch ( ch.prop ) {
				case 'Xrotation':
				    this.autoDetectRotation(ch.node, "X", parseFloat(this.data[n]));
					//ch.node.rotation.x = (parseFloat(this.data[n])) * BVH.TO_RAD;
					break;
				case 'Yrotation':
				    this.autoDetectRotation(ch.node, "Y", parseFloat(this.data[n]));
					//ch.node.rotation.y = (parseFloat(this.data[n])) * BVH.TO_RAD;
					break;
				case 'Zrotation':
				    this.autoDetectRotation(ch.node, "Z", parseFloat(this.data[n]));
					//ch.node.rotation.z = (parseFloat(this.data[n])) * BVH.TO_RAD;
					break;
				case 'Xposition':
				    if(isRoot) ch.node.position.x = ch.node.offset.x + parseFloat(this.data[n])+ this.position.x;
					else ch.node.position.x = ch.node.offset.x + parseFloat(this.data[n]);
					break;
				case 'Yposition':
				    if(isRoot) ch.node.position.y = ch.node.offset.y + parseFloat(this.data[n])+ this.position.y;
					else ch.node.position.y = ch.node.offset.y + parseFloat(this.data[n]);
					break;
				case 'Zposition':
				    if(isRoot) ch.node.position.z = ch.node.offset.z + parseFloat(this.data[n])+ this.position.z;
					else ch.node.position.z = ch.node.offset.z + parseFloat(this.data[n]);
				break;
			}

			n++;
		}

		if(this.bones.length > 0) this.updateSkeleton();
		
    },
    autoDetectRotation:function(Obj, Axe, Angle){

    	this.tmpOrder+=Axe;
    	var angle = Angle * BVH.TO_RAD;

    	if(Axe === "X")this.tmpAngle[0] = angle;
    	else if(Axe === "Y")this.tmpAngle[1] = angle;
    	else this.tmpAngle[2] = angle;

    	if(this.tmpOrder.length===3){
    		//console.log(this.tmpOrder)
    		var e = new THREE.Euler( this.tmpAngle[0], this.tmpAngle[1], this.tmpAngle[2], this.tmpOrder );
    		this.order[Obj.name] =  this.tmpOrder ;
    		Obj.setRotationFromEuler(e);

    		Obj.updateMatrixWorld();

    		this.tmpOrder = "";
    		this.tmpAngle.length = 0;
    	}

    },
    update:function(){
    	if ( this.play ) { 
			this.frame = ((((Date.now() - this.startTime) / this.secsPerFrame / 1000) )*this.speed)| 0;
			if(this.oldFrame!==0)this.frame += this.oldFrame;
			if(this.frame > this.numFrames ){this.frame = 0;this.oldFrame=0; this.startTime =Date.now() }

			this.animate();
		}
    },
    next:function(){
    	this.play = false;
    	this.frame ++;
    	if(this.frame > this.numFrames )this.frame = 0;
    	this.animate();
    },
    prev:function(){
    	this.play = false;
    	this.frame --;
    	if(this.frame<0)this.frame = this.numFrames;
    	this.animate();
    }

}

BVH.DistanceTest = function( p1, p2 ){
    var x = p2.x-p1.x;
    var y = p2.y-p1.y;
    var z = p2.z-p1.z;
    var d = Math.sqrt(x*x + y*y + z*z);
    if(d<=0)d=0.1;
    return d;
}