const fs = require('fs');
const path = require('path');

const descriptionsPath = path.join(process.cwd(), 'data', 'description.json');

function getDescriptions() {
  try {
    const data = fs.readFileSync(descriptionsPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveDescriptions(descriptions) {
  fs.writeFileSync(descriptionsPath, JSON.stringify(descriptions, null, 2));
}

module.exports = {
  getDescriptions,
  saveDescriptions
};
