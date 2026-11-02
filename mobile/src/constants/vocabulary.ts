/**
 * Preferred object names for the AI identifier (sceneIdentifier), so it says "jeepney" rather than
 * "bus" and "monobloc chair" rather than "seat". It may still use any other name it is sure of;
 * this list only steers wording. Names the user teaches are added on top (settings.custom_object_names).
 */
export const BASE_VOCABULARY: string[] = [
  // Vehicles and road
  'jeepney', 'tricycle', 'pedicab', 'habal-habal motorcycle', 'motorcycle', 'scooter', 'bicycle', 'e-bike',
  'car', 'van', 'pickup truck', 'truck', 'bus', 'ambulance', 'fire truck', 'tractor', 'kariton cart',
  'wheelbarrow', 'pothole', 'open drainage', 'manhole', 'curb', 'speed bump', 'traffic cone', 'road barrier',
  'construction barrier', 'gravel pile', 'sand pile', 'hollow blocks', 'rock', 'fallen branch', 'puddle',
  'electric post', 'lamp post', 'signpost', 'traffic light', 'pedestrian lane',
  // Structures
  'stairs', 'concrete stairs', 'wooden ladder', 'ramp', 'railing', 'gate', 'fence', 'door', 'doorway',
  'wall', 'pillar', 'window', 'low ceiling beam', 'awning', 'sari-sari store counter',
  // Furniture
  'monobloc chair', 'plastic chair', 'stool', 'bench', 'table', 'desk', 'sofa', 'bed', 'cabinet', 'shelf',
  'drawer', 'aparador wardrobe',
  // Appliances and electronics
  'electric fan', 'stand fan', 'rice cooker', 'electric kettle', 'water dispenser', 'refrigerator',
  'washing machine', 'television', 'laptop', 'computer monitor', 'keyboard', 'mobile phone',
  'extension cord', 'electrical cable', 'gas stove', 'lpg tank', 'microwave oven', 'flat iron',
  // Household and kitchen
  'plastic basin', 'palanggana', 'pail', 'timba', 'tabo dipper', 'water drum', 'broom', 'walis tingting',
  'dustpan', 'mop', 'trash bin', 'garbage bag', 'laundry basket', 'clothesline', 'bottle', 'water jug',
  'cooking pot', 'frying pan', 'plate', 'cup', 'drinking glass', 'kaldero pot', 'thermos',
  'plastic container', 'box', 'sack', 'umbrella', 'bag', 'backpack', 'suitcase',
  // Clothing and personal
  'slippers', 'tsinelas', 'shoes', 'motorcycle helmet', 'cap', 'eyeglasses', 'white cane',
  // Tools and construction
  'shovel', 'hammer', 'machete', 'ladder', 'toolbox', 'hose', 'bucket', 'cement bag', 'plywood',
  // Plants and animals
  'tree', 'coconut tree', 'banana plant', 'potted plant', 'flowerpot', 'person', 'child', 'dog', 'cat',
  'chicken', 'rooster', 'goat', 'carabao', 'cow', 'pig', 'horse', 'bird',
];

/** Base vocabulary plus names the user added, without duplicates */
export function vocabularyWith(custom: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...custom, ...BASE_VOCABULARY]) {
    const name = raw.trim().toLowerCase();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}
