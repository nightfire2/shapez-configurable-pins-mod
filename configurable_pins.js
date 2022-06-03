// @ts-nocheck
const METADATA = {
    website: "https://github.com/nightfire2/shapez-configurable-pins-mod",
    author: "nightfire",
    name: "Configurable Pins",
    version: "1",
    id: "configurable-pins",
    description: "Allows rotating pins",
    minimumGameVersion: ">=1.5.0",

    // You can specify this parameter if savegames will still work
    // after your mod has been uninstalled
    doesNotAffectSavegame: true,
};

class PinConfigurator extends shapez.BaseHUDPart {

    initialize() {
        const keyActionMapper = this.root.keyMapper;

        keyActionMapper.getBinding(shapez.KEYMAPPINGS.placement.rotateWhilePlacing).add(this.tryRotate, this);
        this.placementBlueprint = this.root.hud.parts.blueprintPlacer.currentBlueprint
        this.placementBuilding = this.root.hud.parts.buildingPlacer.currentMetaBuilding

    }

    canRotate(){
        return this.root.currentLayer === "wires" 
            && !this.root.camera.getIsMapOverlayActive()
            && !this.placementBlueprint.get()
            && !this.placementBuilding.get();
    }

    getBuildingWithPins(tile){
        const building = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        if(building && building.components.WiredPins && building.components.WiredPins.slots.length > 0){
            return building;
        }
    }

    getWorldPositionPins(building) {
        const rotation = building.components.StaticMapEntity.rotation;
        return building.components.WiredPins.slots.map(pin=>{
            const [x,y] = this.rotatePoints(pin.pos.x,pin.pos.y,rotation);
            return {
                x: x,
                y: y,
                pin:pin
            }
        })
    }
    getValidPinRotations(building,worldPins,tile,rotateCC){
        const rotateMultiplier = rotateCC?-1:1;
        console.log(worldPins);
        const origin = building.components.StaticMapEntity.origin;
        const pinsUnderCursor = worldPins.filter(item=>{
            return item.x+origin.x == tile.x && item.y+origin.y==tile.y;
        });
        for(let angle = 90;angle<360;angle+=90){
            const attemptedRotation = pinsUnderCursor.map(pin=>{
                const direction = this.rotateDirection(pin.pin.direction,rotateMultiplier*angle);
                const point = this.getPointInfrontOfPin(pin.pin,direction);
                console.log(point);
                console.log(direction);
                const collision = worldPins.filter(pin=>{
                    return pin.pin.pos.x == point[0] && pin.pin.pos.y==point[1];
                }).length > 0
                return {
                    pin:pin.pin,
                    collision:collision,
                    newDirection:direction
                }; 
            });
            if(!attemptedRotation.some(attempt=> attempt.collision)){
                return attemptedRotation;
            }
        }
        
        console.log(rotateablePins);
        
        return [];
    }
    rotateDirection(direction,angle){

        const rotationOrder = ["top","right","bottom","left"];
        const directionIndex = {
            "top":0,
            "right":1,
            "bottom":2,
            "left":3
        }
        console.log(direction);
        console.log(angle);
        return rotationOrder[(directionIndex[direction]+(angle%360)/90)%4];
    }
    getPointInfrontOfPin(pin,direction){
        switch(direction){
            case "left":
                return [pin.pos.x-1,pin.pos.y];
            case "right":
                return [pin.pos.x+1,pin.pos.y]
            case "top":
                return [pin.pos.x,pin.pos.y-1]        
            case "bottom":
                return [pin.pos.x,pin.pos.y+1]
        }
    }

    rotatePoints(x,y,angle){
        console.log(angle);
        switch(angle%360){
            case 90:
                return [-y,x];
            case 180:
                return [-x,-y];
            case 270:
                return [y,-x];
        }
        return [x,y];
    }

    tryRotate() {
        //console.log(this);
        if (this.canRotate()) {

            const mousePosition = this.root.app.mousePosition;
            if (!mousePosition) {
                // Not on screen
                return;
            }
            const worldPos = this.root.camera.screenToWorld(mousePosition);
            const tile = worldPos.toTileSpace();

            const currentBuilding = this.getBuildingWithPins(tile);
            if(currentBuilding){
                console.log(currentBuilding);
                console.log(tile);
                
                const pins = this.getWorldPositionPins(currentBuilding);
                const rotateCC = this.root.keyMapper.getBinding(shapez.KEYMAPPINGS.placement.rotateInverseModifier).pressed;
                const rotations = this.getValidPinRotations(currentBuilding,pins,tile,rotateCC);
                console.log(rotations);
                rotations.forEach(rotation=>rotation.pin.direction = rotation.newDirection);
            } 
        }
    }
}

function unpackDir(packedDir){
    switch(packedDir){
        case "l":
            return "left";
        case "r":
            return "right";
        case "t":
            return "top";
        case "b":
            return "bottom";
    }
}

class Mod extends shapez.Mod {
    init() {
        // Start the modding here
        this.modInterface.registerHudElement("pin_configurator", PinConfigurator);
        replaceStaticMethod(shapez.WiredPinsComponent,"getSchema",function(getSchema,args) {
            const schema = getSchema();
            schema.slots.innerType.descriptor["direction"] = shapez.types.nullable(shapez.types.string);
            return schema;
        });

        const WiredPinsExtension = ({$super,$old}) => ({
            copyAdditionalStateTo(otherComponent) {
                for (let i = 0; i < otherComponent.slots.length; ++i) {
                    otherComponent.slots[i].direction=this.slots[i].direction;
                }
            }
        });
        this.modInterface.extendClass(shapez.WiredPinsComponent, WiredPinsExtension);

        // this.modInterface.replaceMethod(shapez.WiredPinsComponent, "setSlots", function (
        //     $original,
        //     [slots]
        // ) {
        //     $original(slots);
        //     for (let i = 0; i < slots.length; ++i) {
        //         const slotData = slots[i];
        //         const dir = slotData.dir;
        //         if(dir!=null) {
        //             this.slots[i].direction = unpackDir(dir);
        //         }
        //     }
            
    
        // });
    }
}

function replaceStaticMethod(classHandle, methodName, override) {
    const oldMethod = classHandle[methodName];
    classHandle[methodName] = function () {
        //@ts-ignore This is true I just cant tell it that arguments will be Arguments<O>
        return override.call(this, oldMethod.bind(this), arguments);
    };
}