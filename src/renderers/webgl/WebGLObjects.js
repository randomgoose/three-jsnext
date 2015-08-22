import { InterleavedBufferAttribute } from '../../core/InterleavedBufferAttribute';
import { InterleavedBuffer } from '../../core/InterleavedBuffer';
import { InstancedBufferAttribute } from '../../core/InstancedBufferAttribute';
import { DynamicBufferAttribute } from '../../core/DynamicBufferAttribute';
import { ImmediateRenderObject } from '../../extras/objects/ImmediateRenderObject';
import { PointCloud } from '../../objects/PointCloud';
import { Line } from '../../objects/Line';
import { Mesh } from '../../objects/Mesh';
import { Matrix3 } from '../../math/Matrix3';
import { Matrix4 } from '../../math/Matrix4';
import { WebGLGeometries } from './WebGLGeometries';

/**
* @author mrdoob / http://mrdoob.com/
*/

function WebGLObjects ( gl, properties, info ) {
	this.isWebGLObjects = true;

	var objects = {};
	var objectsImmediate = [];

	var morphInfluences = new Float32Array( 8 );

	var geometries = new WebGLGeometries( gl, info );

	//

	function onObjectRemoved( event ) {

		var object = event.target;

		object.traverse( function ( child ) {

			child.removeEventListener( 'remove', onObjectRemoved );
			removeObject( child );

		} );

	}

	function removeObject( object ) {

		if ( (object && object.isMesh) ||
			 (object && object.isPointCloud) ||
			 (object && object.isLine) ) {

			delete objects[ object.id ];

		} else if ( (object && object.isImmediateRenderObject) || object.immediateRenderCallback ) {

			removeInstances( objectsImmediate, object );

		}

		delete object._modelViewMatrix;
		delete object._normalMatrix;

		properties.delete( object );

	}

	function removeInstances( objlist, object ) {

		for ( var o = objlist.length - 1; o >= 0; o -- ) {

			if ( objlist[ o ].object === object ) {

				objlist.splice( o, 1 );

			}

		}

	}

	//

	this.objects = objects;
	this.objectsImmediate = objectsImmediate;

	this.geometries = geometries;

	this.init = function ( object ) {

		var objectProperties = properties.get( object );

		if ( objectProperties.__webglInit === undefined ) {

			objectProperties.__webglInit = true;
			object._modelViewMatrix = new Matrix4();
			object._normalMatrix = new Matrix3();

			object.addEventListener( 'removed', onObjectRemoved );

		}

		if ( objectProperties.__webglActive === undefined ) {

			objectProperties.__webglActive = true;

			if ( (object && object.isMesh) || (object && object.isLine) || (object && object.isPointCloud) ) {

				objects[ object.id ] = {
					id: object.id,
					object: object,
					z: 0
				};

			} else if ( (object && object.isImmediateRenderObject) || object.immediateRenderCallback ) {

				objectsImmediate.push( {
					id: null,
					object: object,
					opaque: null,
					transparent: null,
					z: 0
				} );

			}

		}

	};

	function numericalSort ( a, b ) {

		return b[ 0 ] - a[ 0 ];

	}

	function updateObject( object ) {

		var geometry = geometries.get( object );

		if ( object.geometry.dynamic === true ) {

			geometry.updateFromObject( object );

		}

		// morph targets

		if ( object.morphTargetInfluences !== undefined ) {

			var activeInfluences = [];
			var morphTargetInfluences = object.morphTargetInfluences;

			for ( var i = 0, l = morphTargetInfluences.length; i < l; i ++ ) {

				var influence = morphTargetInfluences[ i ];
				activeInfluences.push( [ influence, i ] );

			}

			activeInfluences.sort( numericalSort );

			if ( activeInfluences.length > 8 ) {

				activeInfluences.length = 8;

			}

			for ( var i = 0, l = activeInfluences.length; i < l; i ++ ) {

				morphInfluences[ i ] = activeInfluences[ i ][ 0 ];

				var attribute = geometry.morphAttributes[ activeInfluences[ i ][ 1 ] ];
				geometry.addAttribute( 'morphTarget' + i, attribute );

			}

			var material = object.material;

			if ( material.program !== undefined ) {

				var uniforms = material.program.getUniforms();

				if ( uniforms.morphTargetInfluences !== null ) {

					gl.uniform1fv( uniforms.morphTargetInfluences, morphInfluences );

				}

			} else {

				console.warn( 'TOFIX: material.program is undefined' );

			}

		}

		//

		var attributes = geometry.attributes;

		for ( var name in attributes ) {

			var attribute = attributes[ name ];

			var bufferType = ( name === 'index' ) ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

			var data = ( (attribute && attribute.isInterleavedBufferAttribute) ) ? attribute.data : attribute;

			var attributeProperties = properties.get( data );

			if ( attributeProperties.__webglBuffer === undefined ) {

				attributeProperties.__webglBuffer = gl.createBuffer();
				gl.bindBuffer( bufferType, attributeProperties.__webglBuffer );

				var usage = gl.STATIC_DRAW;

				if ( (data && data.isDynamicBufferAttribute)
						 || ( (data && data.isInstancedBufferAttribute) && data.dynamic === true )
						 || ( (data && data.isInterleavedBuffer) && data.dynamic === true ) ) {

					usage = gl.DYNAMIC_DRAW;

				}

				gl.bufferData( bufferType, data.array, usage );

				data.needsUpdate = false;

			} else if ( data.needsUpdate === true ) {

				gl.bindBuffer( bufferType, attributeProperties.__webglBuffer );

				if ( data.updateRange === undefined || data.updateRange.count === -1 ) { // Not using update ranges

					gl.bufferSubData( bufferType, 0, data.array );

				} else if ( data.updateRange.count === 0 ) {

					console.error( 'THREE.WebGLRenderer.updateObject: using updateRange for THREE.DynamicBufferAttribute and marked as needsUpdate but count is 0, ensure you are using set methods or updating manually.' );

				} else {

					gl.bufferSubData( bufferType, data.updateRange.offset * data.array.BYTES_PER_ELEMENT,
									 data.array.subarray( data.updateRange.offset, data.updateRange.offset + data.updateRange.count ) );

					data.updateRange.count = 0; // reset range

				}

				data.needsUpdate = false;

			}

		}

	};

	// returns the webgl buffer for a specified attribute
	this.getAttributeBuffer = function ( attribute ) {

		if ( (attribute && attribute.isInterleavedBufferAttribute) ) {

			return properties.get( attribute.data ).__webglBuffer

		}

		return properties.get( attribute ).__webglBuffer;

	}

	this.update = function ( renderList ) {

		for ( var i = 0, ul = renderList.length; i < ul; i++ ) {

			var object = renderList[i].object;

			if ( object.material.visible !== false ) {

				updateObject( object );

			}

		}

	};

	this.clear = function () {

		objects = {};
		objectsImmediate = [];

	};

};


export { WebGLObjects };