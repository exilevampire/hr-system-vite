"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_SOURCE_TYPES = exports.SOURCE_TYPE_FULL_NAMES = void 0;
exports.isSupportedSourceType = isSupportedSourceType;
exports.sourceTypeFullName = sourceTypeFullName;
exports.SOURCE_TYPE_FULL_NAMES = {
    1: "สำนักงานบริหารทรัพยากรบุคคล (สบค.)",
    2: "ศูนย์บริการโลหิตแห่งชาติ (ศล.)",
    3: "โรงพยาบาลจุฬาลงกรณ์ สภากาชาดไทย",
};
exports.SUPPORTED_SOURCE_TYPES = new Set([1, 2, 3]);
function isSupportedSourceType(sourceType) {
    return exports.SUPPORTED_SOURCE_TYPES.has(sourceType);
}
function sourceTypeFullName(sourceType) {
    return exports.SOURCE_TYPE_FULL_NAMES[sourceType] ?? `ต้นทาง ${sourceType}`;
}
