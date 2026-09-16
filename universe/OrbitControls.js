// OrbitControls for Three.js r152
// Simplified version for the voxel universe

THREE.OrbitControls = function ( object, domElement ) {

    this.object = object;
    this.domElement = ( domElement !== undefined ) ? domElement : document;

    // API

    this.enabled = true;

    this.center = new THREE.Vector3();

    this.userZoom = true;
    this.userZoomSpeed = 1.0;

    this.userRotate = true;
    this.userRotateSpeed = 1.0;

    this.userPan = true;
    this.userPanSpeed = 2.0;

    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    this.minDistance = 0;
    this.maxDistance = Infinity;

    // 65 /*Dolly*/, 18 /*Wheel*/, 16 /*Touch*/
    this.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

    // for reset
    this.target0 = this.center.clone();
    this.position0 = this.object.position.clone();
    this.up0 = this.object.up.clone();
// internals

    this.phiDelta = 0;
    this.thetaDelta = 0;
    this.scale = 1;
    this.panOffset = new THREE.Vector3();
    this.zoomChanged = false;
    this.eps = 0.000001;

    // events

    var changeEvent = { type: 'change' };
    var startEvent = { type: 'start' };
    var endEvent = { type: 'end' };

    // internals

    var scope = this;

    var STATE = { NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 6, TOUCH_DOLLY_PAN: 7 };

    this.state = STATE.NONE;

    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();

    var panStart = new THREE.Vector2();
    var panEnd = new THREE.Vector2();
    var panDelta = new THREE.Vector2();

    var dollyStart = new THREE.Vector2();
    var dollyEnd = new THREE.Vector2();
    var dollyDelta = new THREE.Vector2();

    var phiDelta = 0;
    var thetaDelta = 0;
    var scale = 1;
    var panOffset = new THREE.Vector3();
    var zoomChanged = false;

    function getAutoRotationAngle() {

        return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

    }

    function getZoomScale() {

        return Math.pow( 0.95, scope.userZoomSpeed );

    }

    function rotateLeft( angle ) {

        var spherical = new THREE.Spherical().setFromVector3( scope.object.position.clone().sub( scope.center ) );

        spherical.theta -= angle;

        var pos = scope.center.clone().setFromSpherical( spherical );

        scope.object.position.copy( pos );

        scope.object.lookAt( scope.center );

    }

    function rotateUp( angle ) {

        var spherical = new THREE.Spherical().setFromVector3( scope.object.position.clone().sub( scope.center ) );

        spherical.phi -= angle;

        spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );

        var pos = scope.center.clone().setFromSpherical( spherical );

        scope.object.position.copy( pos );

        scope.object.lookAt( scope.center );

    }

    function panLeft( distance ) {

        var te = scope.object.matrix.elements;
        // get X column of matrix
        te[0]; // is first
        te[4]; // is second
        te[8]; // is third
        te[12]; // is fourth
        var v = new THREE.Vector3( te[0], te[4], te[8] );
        v.multiplyScalar( - distance );

        scope.object.position.add( v );
        scope.center.add( v );

    }

    function panUp( distance ) {

        var te = scope.object.matrix.elements;
        // get Y column of matrix
        te[1]; // is first
        te[5]; // is second
        te[9]; // is third
        te[13]; // is fourth
        var v = new THREE.Vector3( te[1], te[5], te[9] );
        v.multiplyScalar( distance );

        scope.object.position.add( v );
        scope.center.add( v );

    }

    // deltaX and deltaY are in pixels; right and down are positive
    var pan = function( deltaX, deltaY ) {

        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

        if ( scope.object.fov !== undefined ) {

            // perspective
            var position = scope.object.position;
            var offset = position.clone().sub( scope.center );
            var targetDistance = offset.length();

            // half of the fov is center to top of screen
            targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );

            // we actually don't use screenWidth, since perspective camera is fixed to screen height
            panLeft( 2 * deltaX * targetDistance / element.clientHeight );
            panUp( 2 * deltaY * targetDistance / element.clientHeight );

        } else if ( scope.object.isOrthographicCamera === true ) {

            // orthographic
            panLeft( deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / element.clientWidth );
            panUp( deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom / element.clientHeight );

        } else {

            // camera neither perspective nor orthographic
            console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
            scope.userPan = false;

        }

    };

    function dollyIn( dollyScale ) {

        if ( scope.object.isPerspectiveCamera === true ) {

            scale /= dollyScale;

        } else if ( scope.object.isOrthographicCamera === true ) {

            scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom * dollyScale ) );
            scope.object.updateProjectionMatrix();
            zoomChanged = true;

        } else {

            console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
            scope.userZoom = false;

        }

    }

    function dollyOut( dollyScale ) {

        if ( scope.object.isPerspectiveCamera === true ) {

            scale *= dollyScale;

        } else if ( scope.object.isOrthographicCamera === true ) {

            scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / dollyScale ) );
            scope.object.updateProjectionMatrix();
            zoomChanged = true;

        } else {

            console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
            scope.userZoom = false;

        }

    }

    //
    // event handlers - update the object state
    //

    function handleMouseDownRotate( event ) {

        // console.log( 'handleMouseDownRotate' );

        rotateStart.set( event.clientX, event.clientY );

    }

    function handleMouseDownDolly( event ) {

        // console.log( 'handleMouseDownDolly' );

        dollyStart.set( event.clientX, event.clientY );

    }

    function handleMouseDownPan( event ) {

        // console.log( 'handleMouseDownPan' );

        panStart.set( event.clientX, event.clientY );

    }

    function handleMouseMoveRotate( event ) {

        // console.log( 'handleMouseMoveRotate' );

        rotateEnd.set( event.clientX, event.clientY );

        rotateDelta.subVectors( rotateEnd, rotateStart );

        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

        // rotating across whole screen goes 360 degrees around
        scope.thetaDelta += 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.userRotateSpeed;

        // rotating up and down along whole screen attempts to go 360, but limited to 180
        scope.phiDelta += 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.userRotateSpeed;

        rotateStart.copy( rotateEnd );

        scope.update();

    }

    function handleMouseMoveDolly( event ) {

        // console.log( 'handleMouseMoveDolly' );

        dollyEnd.set( event.clientX, event.clientY );

        dollyDelta.subVectors( dollyEnd, dollyStart );

        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

        if ( dollyDelta.y > 0 ) {

            dollyIn( getZoomScale() );

        } else if ( dollyDelta.y < 0 ) {

            dollyOut( getZoomScale() );

        }

        dollyStart.copy( dollyEnd );

        scope.update();

    }

    function handleMouseMovePan( event ) {

        // console.log( 'handleMouseMovePan' );

        panEnd.set( event.clientX, event.clientY );

        panDelta.subVectors( panEnd, panStart );

        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

        pan( panDelta.x, panDelta.y );

        panStart.copy( panEnd );

        scope.update();

    }

    function handleMouseUp( /* event */ ) {

        // console.log( 'handleMouseUp' );

    }

    function handleMouseWheel( event ) {

        // console.log( 'handleMouseWheel' );

        if ( event.deltaY < 0 ) {

            dollyOut( getZoomScale() );

        } else if ( event.deltaY > 0 ) {

            dollyIn( getZoomScale() );

        }

        scope.update();

    }

    function handleKeyDown( event ) {

        // console.log( 'handleKeyDown' );

        var needsUpdate = false;

        switch ( event.keyCode ) {

            case scope.keys.UP:
                scope.pan( 0, scope.keyPanSpeed );
                needsUpdate = true;
                break;

            case scope.keys.BOTTOM:
                scope.pan( 0, - scope.keyPanSpeed );
                needsUpdate = true;
                break;

            case scope.keys.LEFT:
                scope.pan( scope.keyPanSpeed, 0 );
                needsUpdate = true;
                break;

            case scope.keys.RIGHT:
                scope.pan( - scope.keyPanSpeed, 0 );
                needsUpdate = true;
                break;

        }

        if ( needsUpdate ) {

            // prevent the browser from scrolling on cursor keys
            event.preventDefault();

            scope.update();

        }

    }

    function handleTouchStartRotate( event ) {

        // console.log( 'handleTouchStartRotate' );

        if ( event.touches.length == 1 ) {

            rotateStart.set( event.touches[ 0 ].clientX, event.touches[ 0 ].clientY );

        } else {

            var x =  event.touches[ 0 ].clientX - event.touches[ 1 ].clientX;
            var y =  event.touches[ 0 ].clientY - event.touches[ 1 ].clientY;

            var length = Math.sqrt( x * x + y * y );

            dollyStart.set( 0, length );

            rotateStart.set( 0, 0 );

        }

    }

    function handleTouchStartDollyPan( event ) {

        // console.log( 'handleTouchStartDollyPan' );

        if ( event.touches.length >= 2 ) {

            var x =  event.touches[ 0 ].clientX - event.touches[ 1 ].clientX;
            var y =  event.touches[ 0 ].clientY - event.touches[ 1 ].clientY;

            var length = Math.sqrt( x * x + y * y );

            dollyStart.set( 0, length );

            panStart.set( event.touches[ 0 ].clientX, event.touches[ 0 ].clientY );

        }

    }

    function handleTouchStartDolly( event ) {

        // console.log( 'handleTouchStartDolly' );

        var x =  event.touches[ 0 ].clientX - event.touches[ 1 ].clientX;
        var y =  event.touches[ 0 ].clientY - event.touches[ 1 ].clientY;

        var length = Math.sqrt( x * x + y * y );

        dollyStart.set( 0, length );

    }

    function handleTouchStartPan( event ) {

        // console.log( 'handleTouchStartPan' );

        if ( event.touches.length >= 2 ) {

            panStart.set( event.touches[ 0 ].clientX, event.touches[ 0 ].clientY );

        }

    }
function handleTouchMoveRotate( event ) {

        // console.log( 'handleTouchMoveRotate' );

        if ( event.touches.length == 1 ) {

            rotateEnd.set( event.touches[ 0 ].clientX, event.touches[ 0 ].clientY );

            rotateDelta.subVectors( rotateEnd, rotateStart );

            if ( event.touches.length == 1 ) {

                var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

                // rotating across whole screen goes 360 degrees around
                scope.thetaDelta += 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.userRotateSpeed;

                // rotating up and down along whole screen attempts to go 360, but limited to 180
                scope.phiDelta += 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.userRotateSpeed;

                rotateStart.copy( rotateEnd );

            }

            scope.update();

        }

    }

    function handleTouchMoveDollyPan( event ) {

        // console.log( 'handleTouchMoveDollyPan' );

        if ( event.touches.length >= 2 ) {

            var x =  event.touches[ 0 ].clientX - event.touches[ 1 ].clientX;
            var y =  event.touches[ 0 ].clientY - event.touches[ 1 ].clientY;

            var length = Math.sqrt( x * x + y * y );

            dollyEnd.set( 0, length );

            dollyDelta.subVectors( dollyEnd, dollyStart );

            if ( dollyDelta.y > 0 ) {

                dollyIn( getZoomScale() );

            } else if ( dollyDelta.y < 0 ) {

                dollyOut( getZoomScale() );

            }

            dollyStart.copy( dollyEnd );

            panEnd.set( event.touches[ 0 ].clientX, event.touches[ 0 ].clientY );

            panDelta.subVectors( panEnd, panStart );

            pan( panDelta.x, panDelta.y );

            panStart.copy( panEnd );

            scope.update();

        }

    }

    function handleTouchMoveDolly( event ) {

        // console.log( 'handleTouchMoveDolly' );

        var x =  event.touches[ 0 ].clientX - event.touches[ 1 ].clientX;
        var y =  event.touches[ 0 ].clientY - event.touches[ 1 ].clientY;

        var length = Math.sqrt( x * x + y * y );

        dollyEnd.set( 0, length );

        dollyDelta.subVectors( dollyEnd, dollyStart );

        if ( dollyDelta.y > 0 ) {

            dollyIn( getZoomScale() );

        } else if ( dollyDelta.y < 0 ) {

            dollyOut( getZoomScale() );

        }

        dollyStart.copy( dollyEnd );

        scope.update();

    }

    function handleTouchMovePan( event ) {

        // console.log( 'handleTouchMovePan' );

        if ( event.touches.length >= 2 ) {

            panEnd.set( event.touches[ 0 ].clientX, event.touches[ 0 ].clientY );

            panDelta.subVectors( panEnd, panStart );

            pan( panDelta.x, panDelta.y );

            panStart.copy( panEnd );

            scope.update();

        }

    }

    function handleTouchEnd( /* event */ ) {

        // console.log( 'handleTouchEnd' );

    }

    //
    // event handlers - FSM: listen for events and reset state
    //

    function onMouseDown( event ) {

        if ( scope.enabled === false ) return;

        event.preventDefault();

        switch ( event.button ) {

            case scope.mouseButtons.LEFT:

                if ( event.ctrlKey || event.shiftKey || event.metaKey ) {

                    if ( scope.userPan === false ) return;

                    handleMouseDownPan( event );

                    this.state = STATE.PAN;

                } else {

                    if ( scope.userRotate === false ) return;

                    handleMouseDownRotate( event );

                    this.state = STATE.ROTATE;

                }

                break;

            case scope.mouseButtons.MIDDLE:

                if ( scope.userZoom === false ) return;

                handleMouseDownDolly( event );

                this.state = STATE.DOLLY;

                break;

            case scope.mouseButtons.RIGHT:

                if ( scope.userPan === false ) return;

                handleMouseDownPan( event );

                this.state = STATE.PAN;

                break;

        }

        if ( this.state !== STATE.NONE ) {

            scope.domElement.addEventListener( 'mousemove', onMouseMove, false );
            scope.domElement.addEventListener( 'mouseup', onMouseUp, false );
            scope.dispatchEvent( startEvent );

        }

    }

    function onMouseMove( event ) {

        if ( scope.enabled === false ) return;

        event.preventDefault();

        switch ( this.state ) {

            case STATE.ROTATE:

                if ( scope.userRotate === false ) return;

                handleMouseMoveRotate( event );

                break;

            case STATE.DOLLY:

                if ( scope.userZoom === false ) return;

                handleMouseMoveDolly( event );

                break;

            case STATE.PAN:

                if ( scope.userPan === false ) return;

                handleMouseMovePan( event );

                break;

        }

    }

    function onMouseUp( /* event */ ) {

        if ( scope.enabled === false ) return;

        scope.domElement.removeEventListener( 'mousemove', onMouseMove, false );
        scope.domElement.removeEventListener( 'mouseup', onMouseUp, false );
        scope.dispatchEvent( endEvent );
        this.state = STATE.NONE;

    }

    function onMouseWheel( event ) {

        if ( scope.enabled === false ) return;

        event.preventDefault();
        event.stopPropagation();

        handleMouseWheel( event );

        scope.dispatchEvent( startEvent );
        scope.dispatchEvent( endEvent );

    }

    function onKeyDown( event ) {

        if ( scope.enabled === false ) return;

        handleKeyDown( event );

    }

    function onTouchStart( event ) {

        if ( scope.enabled === false ) return;

        switch ( event.touches.length ) {

            case 1:

                if ( scope.userRotate === false ) return;

                handleTouchStartRotate( event );

                this.state = STATE.TOUCH_ROTATE;

                break;

            case 2:

                if ( scope.userZoom === false && scope.userPan === false ) return;

                handleTouchStartDollyPan( event );

                this.state = STATE.TOUCH_DOLLY_PAN;

                break;

            default:

                this.state = STATE.NONE;

        }

        if ( this.state !== STATE.NONE ) {

            scope.domElement.addEventListener( 'touchmove', onTouchMove, false );
            scope.domElement.addEventListener( 'touchend', onTouchEnd, false );
            scope.dispatchEvent( startEvent );

        }

    }

    function onTouchMove( event ) {

        if ( scope.enabled === false ) return;

        event.preventDefault();
        event.stopPropagation();

        switch ( this.state ) {

            case STATE.TOUCH_ROTATE:

                if ( scope.userRotate === false ) return;

                handleTouchMoveRotate( event );

                break;

            case STATE.TOUCH_DOLLY_PAN:

                if ( scope.userZoom === false && scope.userPan === false ) return;

                handleTouchMoveDollyPan( event );

                break;

        }

    }

    function onTouchEnd( /* event */ ) {

        if ( scope.enabled === false ) return;

        scope.domElement.removeEventListener( 'touchmove', onTouchMove, false );
        scope.domElement.removeEventListener( 'touchend', onTouchEnd, false );
        scope.dispatchEvent( endEvent );
        this.state = STATE.NONE;

    }

    function onContextMenu( /* event */ ) {

        if ( scope.enabled === false ) return;

        event.preventDefault();

    }

    //

    scope.domElement.addEventListener( 'contextmenu', onContextMenu, false );

    scope.domElement.addEventListener( 'mousedown', onMouseDown, false );
    scope.domElement.addEventListener( 'mousewheel', onMouseWheel, false );
    scope.domElement.addEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox

    scope.domElement.addEventListener( 'touchstart', onTouchStart, false );
    scope.domElement.addEventListener( 'touchend', onTouchEnd, false );
    scope.domElement.addEventListener( 'touchmove', onTouchMove, false );

    scope.domElement.addEventListener( 'keydown', onKeyDown, false );

    // force an update at start

    this.update();

};

THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;

Object.defineProperties( THREE.OrbitControls.prototype, {

    center: {

        get: function () {

            return this._center || new THREE.Vector3();

        },

        set: function ( value ) {

            this._center = value;

        }

    },

    // backward compatibility

    noZoom: {

        get: function () {

            return ! this.userZoom;

        },

        set: function ( value ) {

            this.userZoom = ! value;

        }

    },

    noRotate: {

        get: function () {

            return ! this.userRotate;

        },

        set: function ( value ) {

            this.userRotate = ! value;

        }

    },

    noPan: {

        get: function () {

            return ! this.userPan;

        },

        set: function ( value ) {

            this.userPan = ! value;

        }

    },

    noKeys: {

        get: function () {

            return this.keys === null;

        },

        set: function ( value ) {

            this.keys = value ? null : [ 65, 83, 68 ]; // A, S, D

        }

    },

    staticMoving: {

        get: function () {

            return false;

        },

        set: function ( value ) {

            // this is here for backwards compatibility
            // the staticMoving feature was removed from r68 onwards

        }

    },

    dynamicDampingFactor: {

        get: function () {

            return 0.2;

        },

        set: function ( value ) {

            // this is here for backwards compatibility
            // the dynamicDampingFactor feature was removed from r68 onwards

        }

    }

} );

// Methods

THREE.OrbitControls.prototype.getPolarAngle = function () {

    var spherical = new THREE.Spherical().setFromVector3( this.object.position.clone().sub( this.center ) );
    return spherical.phi;

};

THREE.OrbitControls.prototype.getAzimuthalAngle = function () {

    var spherical = new THREE.Spherical().setFromVector3( this.object.position.clone().sub( this.center ) );
    return spherical.theta;

};

THREE.OrbitControls.prototype.distanceToSquared = function () {

    var offset = this.object.position.clone().sub( this.center );
    return offset.dot( offset );

};

THREE.OrbitControls.prototype.saveState = function () {

    this.target0.copy( this.center );
    this.position0.copy( this.object.position );
    this.up0.copy( this.object.up );

};

THREE.OrbitControls.prototype.reset = function () {

    this.center.copy( this.target0 );
    this.object.position.copy( this.position0 );
    this.object.up.copy( this.up0 );

    this.update();

};

THREE.OrbitControls.prototype.update = function () {

    var offset = this.object.position.clone().sub( this.center );

    // angle from z-axis around y-axis
    var theta = Math.atan2( offset.x, offset.z );

    // angle from y-axis
    var phi = Math.acos( THREE.MathUtils.clamp( offset.y / offset.length(), -1, 1 ) );

    if ( this.autoRotate && this.state === STATE.NONE ) {

        this.rotateLeft( getAutoRotationAngle() );

    }

    theta += this.thetaDelta;
    phi += this.phiDelta;

    // restrict theta to be between desired limits
    var min = this.minAzimuthalAngle;
    var max = this.maxAzimuthalAngle;

    if ( isFinite( min ) && isFinite( max ) ) {

        if ( theta < min ) theta = min;
        else if ( theta > max ) theta = max;

    }

    // restrict phi to be between desired limits
    phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, phi ) );

    phi = Math.max( this.eps, Math.min( Math.PI - this.eps, phi ) );

    var radius = offset.length() * this.scale;

    // restrict radius to be between desired limits
    radius = Math.max( this.minDistance, Math.min( this.maxDistance, radius ) );

    // move target to panned location
    this.center.add( this.panOffset );

    offset.setFromSpherical( new THREE.Spherical( radius, phi, theta ) );

    this.object.position.copy( this.center ).add( offset );

    this.object.lookAt( this.center );

    if ( this.enableDamping === true ) {

        this.thetaDelta *= ( 1 - this.dampingFactor );
        this.phiDelta *= ( 1 - this.dampingFactor );

    } else {

        this.thetaDelta = 0;
        this.phiDelta = 0;

    }

    this.scale = 1;
    this.panOffset.set( 0, 0, 0 );

    // update condition is:
    // min(camera displacement, camera rotation in radians)^2 > EPS
    // using small-angle approximation cos(x/2) = 1 - x^2 / 8

    if ( this.zoomChanged ||
        this.object.position.distanceToSquared( this.lastPosition ) > this.eps ||
        8 * ( 1 - this.object.lookAt( this.center ).dot( this.lastUp ) ) > this.eps ) {

        this.dispatchEvent( changeEvent );

        this.lastPosition.copy( this.object.position );
        this.lastUp.copy( this.object.up );

        this.zoomChanged = false;

        return true;

    }

    return false;

};

THREE.OrbitControls.prototype.dispose = function () {

    this.domElement.removeEventListener( 'contextmenu', onContextMenu, false );
    this.domElement.removeEventListener( 'mousedown', onMouseDown, false );
    this.domElement.removeEventListener( 'mousewheel', onMouseWheel, false );
    this.domElement.removeEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox

    this.domElement.removeEventListener( 'touchstart', onTouchStart, false );
    this.domElement.removeEventListener( 'touchend', onTouchEnd, false );
    this.domElement.removeEventListener( 'touchmove', onTouchMove, false );

    document.removeEventListener( 'keydown', onKeyDown, false );

};

// Set to default values

THREE.OrbitControls.prototype.minDistance = 0;
THREE.OrbitControls.prototype.maxDistance = Infinity;

THREE.OrbitControls.prototype.minPolarAngle = 0; // radians
THREE.OrbitControls.prototype.maxPolarAngle = Math.PI; // radians

THREE.OrbitControls.prototype.minAzimuthalAngle = - Infinity; // radians
THREE.OrbitControls.prototype.maxAzimuthalAngle = Infinity; // radians

THREE.OrbitControls.prototype.enableDamping = false;
THREE.OrbitControls.prototype.dampingFactor = 0.2;

THREE.OrbitControls.prototype.enableZoom = true;
THREE.OrbitControls.prototype.userZoom = true;
THREE.OrbitControls.prototype.userZoomSpeed = 1.0;

THREE.OrbitControls.prototype.enableRotate = true;
THREE.OrbitControls.prototype.userRotate = true;
THREE.OrbitControls.prototype.userRotateSpeed = 1.0;

THREE.OrbitControls.prototype.enablePan = true;
THREE.OrbitControls.prototype.userPan = true;
THREE.OrbitControls.prototype.userPanSpeed = 2.0;

THREE.OrbitControls.prototype.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

THREE.OrbitControls.prototype.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

// last position for detecting user interaction

THREE.OrbitControls.prototype.lastPosition = new THREE.Vector3();
THREE.OrbitControls.prototype.lastUp = new THREE.Vector3();

// REQUIRES THREE.MOUSE

THREE.MOUSE = { LEFT: 0, MIDDLE: 1, RIGHT: 2 };

// expose for external use

THREE.OrbitControls = THREE.OrbitControls;