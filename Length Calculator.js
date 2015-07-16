//import required libraries
var bezier = require('bezier-js');  //from https://github.com/Pomax/bezierjs
var fs = require('fs');                     
var svgparser = require('svg-path-parser');    //from https://github.com/hughsk/svg-path-parser
var SVGCurveLib = require('/Users/Jeremy/node_modules/svg-curve-lib/src/js/svg-curve-lib.js');  //from https://github.com/MadLittleMods/svg-curve-lib
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;
var materials_data = require('/Users/Jeremy/Materials_Data/Materials_Data.js');

module.exports.getFilePathLength = getFilePathLength;    //make getFilePathLength available for testing

console.log(getCost("acryllicClear_6mm", getFilePathLength("/test_files/line.svg")['#000000'], getFilePathLength("/test_files/line.svg").jogLength, "diyMember" ));

//Costs calculations
function getCost(material, pathLength, jogLength, membership){
    var time = 0.0;
    time += pathLength / (makerLabs.laserSpeed.maxCutSpeed * makerLabs.materials[material].speed / 100);
    time += jogLength / makerLabs.laserSpeed.maxJogSpeed;
    time = time * makerLabs.materials[material].passes;
    time = time / 60; //convert from minutes to seconds
    return time * makerLabs.cost[membership];
}

function getFilePathLength(string){
    var smallX = Number.MAX_VALUE;
    var smallY = Number.MAX_VALUE;
    var largeX = Number.MAX_VALUE*-1;
    var largeY = Number.MAX_VALUE*-1;
    var map = {jogLength: 0};
    var data = fs.readFileSync(__dirname + string, "utf8");

    while(data.indexOf("xmlns") !== -1){
        var start = data.indexOf("xmlns");
        var end = data.indexOf("\n", start);
        data = data.substring(0, start) + data.substring(end+2);
    }

    var doc = new dom().parseFromString(data);      //parse String into data structure
    var array = xpath.select("//path[@style]", doc);    //find all path nodes with style attribute
    for(var i = 0; i < array.length; i++){
        var path = xpath.select("./@style", array[i]);
        var transform = xpath.select("ancestor::*/@transform", array[i]);
        var transformX = 1;
        var transformY = 1;
        for (var k = 0; k < transform.length; k++){     //take into account transformations
            if(transform[k] !== undefined){
                var temp = transform[k].nodeValue;
                if (temp.indexOf("matrix") !== -1){
                    transformX *= temp.substring(temp.indexOf("(")+1, temp.indexOf(","));
                    var startingIndex = temp.indexOf(",", temp.indexOf(",", temp.indexOf(",") + 1) + 1) + 1;
                    transformY *= temp.substring(startingIndex, temp.indexOf(",", startingIndex));
                }
                else if(temp.indexOf("scale") !== -1 && temp.indexOf(",") !== -1){
                    transformX *= temp.substring(temp.indexOf("(")+1, temp.indexOf(","));
                    transformY *= temp.substring(temp.indexOf(",")+1, temp.indexOf(")"));
                }
                else if(temp.indexOf("scale") !== -1){
                    transformX *= temp.substring(temp.indexOf("(")+1, temp.indexOf(")"));
                    transformY *= 1;
                }
            }
        }
        for(var j = 0; j < path.length; j++){
            var colour = path[j].nodeValue.substring(path[j].nodeValue.indexOf("stroke:")+7,path[j].nodeValue.indexOf("stroke:")+14);   //dealing with opacity, does not calculte length of invisible objects
            if(path[j].nodeValue.indexOf(";",path[j].nodeValue.indexOf(";opacity:")+9) !== -1){
                var opacity = path[j].nodeValue.substring(path[j].nodeValue.indexOf(";opacity:")+9,path[j].nodeValue.indexOf(";",path[j].nodeValue.indexOf(";opacity:")));
            }
            else{
                var opacity = path[j].nodeValue.substring(path[j].nodeValue.indexOf(";opacity:")+9);
            }
            if(opacity !== "0"){
                if(map[colour] != undefined){
                    info = getLength(xpath.select("./@d", array[i])[j].nodeValue, transformX, transformY);
                    map[colour] += info.length;
                    map.jogLength += info.jogLength;
                    if(smallX > info.smallX){
                        smallX = info.smallX;
                    }
                    if(smallY > info.smallY){
                        smallY = info.smallY;
                    }
                    if(largeX < info.largeX){
                        largeX = info.largeX;
                    }
                    if(largeY < info.largeY){
                        largeY = info.largeY;
                    }
                }
                else{
                    info = getLength(xpath.select("./@d", array[i])[j].nodeValue, transformX, transformY);
                    map[colour] = info.length;
                    map.jogLength += info.jogLength;
                    if(smallX > info.smallX){
                        smallX = info.smallX;
                    }
                    if(smallY > info.smallY){
                        smallY = info.smallY;
                    }
                    if(largeX < info.largeX){
                        largeX = info.largeX;
                    }
                    if(largeY < info.largeY){
                        largeY = info.largeY;
                    }
                }
            } 
        }
    } 
    map.xWidth = largeX - smallX;
    map.yLength = largeY - smallY;
    return map;
}

//compares minimum and maximum coordinates of lines for bounding box calculations
function compareLineValues(values){
    if(values.smallX > values.currentX){
        values.smallX = values.currentX;
    }
    if(values.smallY > values.currentY){
        values.smallY = values.currentY;
    }
    if(values.largeX < values.currentX){
        values.largeX = values.currentX;
    }
    if(values.largeY < values.currentY){
        values.largeY = values.currentY;
    }
}

//compares minimum and maximum coordinates of bezier curves for bounding box calculations
function compareCurveValues(values, args){
    if(values.smallX > getCurve.apply(null, args).bbox().x.min){
        values.smallX = getCurve.apply(null, args).bbox().x.min;
    }
    if(values.smallY > getCurve.apply(null, args).bbox().y.min){
        values.smallY = getCurve.apply(null, args).bbox().y.min;
    }
    if(values.largeX < getCurve.apply(null, args).bbox().x.max){
        values.largeX = getCurve.apply(null, args).bbox().x.max;
    }
    if(values.largeY < getCurve.apply(null, args).bbox().y.max){
        values.largeY = getCurve.apply(null, args).bbox().y.max;
    }
}

//Calculates length from path data using helper methods
function getLength(string, transform_X, transform_Y){
    var transformX = transform_X;
    var transformY = transform_Y;
    var values = {
        currentX: 0.0,
        currentY: 0.0,
        smallX: Number.MAX_VALUE,
        largeX: Number.MAX_VALUE*-1,
        smallY: Number.MAX_VALUE,
        largeY: Number.MAX_VALUE*-1,
        closeX: 0.0, //for closing path calculations
        closeY: 0.0,
        smoothX: 0.0, //for shorthand curve calculations
        smoothY: 0.0
    };
    var arrayOfValues = svgparser(string);
    var length = 0.0;
    var jogLength = 0.0;

    for(var i = 0; i < arrayOfValues.length; i++) {
        var temp = arrayOfValues[i];
        switch(temp.command){
            case "moveto":
                if(temp.relative){
                    jogLength += getLineLength([values.currentX, values.currentX + temp.x * transformX], [values.currentY, values.currentY + temp.y * transformY])
                    values.currentX += temp.x * transformX;
                    values.currentY += temp.y * transformY;
                    values.closeX += temp.x * transformX;
                    values.closeY += temp.y * transformY;
                    compareLineValues(values);
                }
                else{
                    jogLength += getLineLength([values.currentX, temp.x * transformX], [values.currentY, temp.y * transformY]);
                    values.currentX = temp.x * transformX;
                    values.currentY = temp.y * transformY;
                    values.closeX = temp.x * transformX;
                    values.closeY = temp.y * transformY;
                    compareLineValues(values);
                }
                break;

            case "lineto":
                if(temp.relative){
                    length += getLineLength([values.currentX, values.currentX + temp.x * transformX], [values.currentY, values.currentY + temp.y * transformY])
                    values.currentX += temp.x * transformX;
                    values.currentY += temp.y * transformY;
                    compareLineValues(values);
                }
                else{
                    length += getLineLength([values.currentX, temp.x * transformX], [values.currentY, temp.y * transformY]);
                    values.currentX = temp.x * transformX;
                    values.currentY = temp.y * transformY;
                    compareLineValues(values);
                }
                break;

            case "horizontal lineto":
                if(temp.relative){
                    length += getLineLength([values.currentX, values.currentX + temp.x * transformX], [values.currentY, values.currentY])
                    values.currentX += temp.x * transformX;
                    compareLineValues(values);
                }
                else{
                    length += getLineLength([values.currentX, temp.x * transformX], [values.currentY, values.currentY]);
                    values.currentX = temp.x * transformX;
                    compareLineValues(values);
                }
                break;

            case "vertical lineto":
                if(temp.relative){
                    length += getLineLength([values.currentX, values.currentX], [values.currentY, values.currentY + temp.y * transformY])
                    values.currentY += temp.y * transformY;
                    compareLineValues(values);
                }
                else{
                    length += getLineLength([values.currentX, values.currentX], [values.currentY, temp.y * transformY]);
                    values.currentY = temp.y * transformY;
                    compareLineValues(values);
                }
                break;

            case "closepath":
                length += getLineLength([values.currentX, values.closeX], [values.currentY, values.closeY]);
                values.currentX = values.closeX;
                values.currentY = values.closeY;
                compareLineValues(values);
                break;

            case "curveto":
                if(temp.relative){
                    var args = [
                        values.currentX,
                        values.currentY,
                        [
                            values.currentX + temp.x1 * transformX,
                            values.currentX + temp.x2 * transformX,
                            values.currentX + temp.x * transformX
                        ], [
                            values.currentY + temp.y1 * transformY,
                            values.currentY + temp.y2 * transformY,
                            values.currentY + temp.y * transformY]
                    ];
                    length += getCurve.apply(null, args).length();
                    compareCurveValues(values,args);
                    values.smoothX = values.currentX + temp.x2 * transformX;
                    values.smoothY = values.currentY + temp.y2 * transformY;
                    values.currentX += temp.x * transformX;
                    values.currentY += temp.y * transformY;
                }
                else{
                    var args = [
                        values.currentX, 
                        values.currentY, 
                        [
                            temp.x1 * transformX, 
                            temp.x2 * transformX, 
                            temp.x * transformX
                        ], [
                            temp.y1 * transformY, 
                            temp.y2 * transformY, 
                            temp.y * transformY]
                    ];
                    length += getCurve.apply(null, args).length();
                    compareCurveValues(values,args);
                    values.currentX = temp.x * transformX;
                    values.currentY = temp.y * transformY;
                    values.smoothX = temp.x2 * transformX;
                    values.smoothY = temp.y2 * transformY;
                }
                break;

            case "smooth curveto":
                if(temp.relative){
                    var args = [
                        values.currentX,
                        values.currentY,
                        [
                            values.currentX * 2 - values.smoothX,
                            values.currentX + temp.x2 * transformX,
                            values.currentX + temp.x * transformX
                        ], [
                            values.currentY * 2 - values.smoothY,
                            values.currentY + temp.y2 * transformY,
                            values.currentY + temp.y * transformY
                        ]
                    ];
                    length += getCurve.apply(null, args).length();
                    compareCurveValues(values,args);
                    values.currentX += temp.x * transformX;
                    values.currentY += temp.y * transformY;
                }
                else{
                    var args = [
                        values.currentX,
                        values.currentY,
                        [
                            values.currentX * 2 - values.smoothX,
                            temp.x2 * transformX,
                            temp.x * transformX
                        ],[
                            values.currentY * 2 - values.smoothY,
                            temp.y2 * transformY, temp.y * transformY
                        ]
                    ];
                    length += getCurve.apply(null, args).length();
                    compareCurveValues(values,args);
                    values.currentX = temp.x * transformX;
                    values.currentY = temp.y * transformY;
                }
                break;

            case "quadratic curveto":
                if(temp.relative){
                    var args = [
                        values.currentX,
                        values.currentY,
                        [
                            values.currentX + temp.x1 * transformX,
                            values.currentX + temp.x * transformX
                        ], [
                            values.currentY + temp.y1 * transformY,
                            values.currentY + temp.y * transformY
                        ]
                    ];
                    length += getCurve.apply(null, args).length();
                    compareCurveValues(values,args);
                    values.smoothX = values.currentX + temp.x1 * transformX;
                    values.smoothY = values.currentY + temp.y1 * transformY;
                    values.currentX += temp.x * transformX;
                    values.currentY += temp.y * transformY;
                }
                else{
                    var args = [
                        values.currentX,
                        values.currentY,
                        [
                            temp.x1 * transformX,
                            temp.x * transformX
                        ], [
                            temp.y1 * transformY,
                            temp.y * transformY
                        ]
                    ];
                    length += getCurve.apply(null, args).length();
                    compareCurveValues(values,args);
                    values.currentX = temp.x * transformX;
                    values.currentY = temp.y * transformY;
                    values.smoothX = temp.x1 * transformX;
                    values.smoothY = temp.y1 * transformY;
                }
                break;

            case "smooth quadratic cuveto":
                if(temp.relative){
                    var args = [
                        values.currentX,
                        values.currentY,
                        [
                            values.currentX * 2 - values.smoothX,
                            values.currentX + temp.x * transformX
                        ], [
                            values.currentY * 2 - values.smoothY,
                            values.currentY + temp.y * transformY
                        ]
                    ];
                    length += getCurve.apply(null, args).length();
                    compareCurveValues(values,args);
                    values.currentX += temp.x * transformX;
                    values.currentY += temp.y * transformY;
                }
                else{
                    var args = [
                        values.currentX,
                        values.currentY,
                        [
                            values.currentX * 2 - values.smoothX,
                            temp.x * transformX
                        ], [
                            values.currentY * 2 - values.smoothY,
                            temp.y * transformY
                        ]
                    ];
                    length += getCurve.apply(null, args).length();
                    compareCurveValues(values,args);
                    values.currentX = temp.x * transformX;
                    values.currentY = temp.y * transformY;
                }
                break;

            case "elliptical arc":
                if(temp.relative){
                    var ellipticalArcArcLengthResult = SVGCurveLib.approximateArcLengthOfCurve(10000, function(t) {
                        return SVGCurveLib.pointOnEllipticalArc({x: values.currentX , y: values.currentY}, temp.rx * transformX, temp.ry * transformY, temp.xAxisRotation, temp.largeArc, temp.sweep, {x: values.currentX + temp.x * transformX, y: values.currentY + temp.y * transformY}, t);
                    });
                    length += ellipticalArcArcLengthResult.arcLength;
                    values.currentX += temp.x * transformX;
                    values.currentY += temp.y * transformY;
                }
                else{
                    var ellipticalArcArcLengthResult = SVGCurveLib.approximateArcLengthOfCurve(10000, function(t) {
                        return SVGCurveLib.pointOnEllipticalArc({x: values.currentX , y: values.currentY}, temp.rx * transformX, temp.ry * transformY, temp.xAxisRotation, temp.largeArc, temp.sweep, {x: temp.x * transformX, y: temp.y * transformY}, t);
                    });
                    length += ellipticalArcArcLengthResult.arcLength;
                    values.currentX = temp.x * transformX;
                    values.currentY = temp.y * transformY;
                }
                break;

            default:
                console.log("Error. Unknown path command.");
        }
    }
    var info = {};
    info.length = length/90;        //dividng by 90 to convert pixels into inches
    info.jogLength = jogLength/90;
    info.smallX = values.smallX/90;
    info.smallY = values.smallY/90;
    info.largeX = values.largeX/90;
    info.largeY = values.largeY/90;
    return info;
}

//calculates length of line given array of x,y coordinates
function getLineLength(x_values, y_values){
    var length = 0;
    for(i = 1; i < x_values.length; i++){
        length += Math.sqrt(Math.pow((x_values[i]-x_values[i-1]), 2)+Math.pow((y_values[i]-y_values[i-1]), 2));
    }
    return length;
}

//returns manipulatable bezier curve
function getCurve(x_current, y_current, x_values, y_values){
    if(x_values.length === 3)
        var curve = new bezier(x_current,y_current , x_values[0],y_values[0] , x_values[1],y_values[1] , x_values[2],y_values[2]);
    else
        var curve = new bezier(x_current,y_current , x_values[0],y_values[0] , x_values[1],y_values[1]);
    return curve;
}