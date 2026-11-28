const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function loadCourses() {
  const ids = JSON.parse(fs.readFileSync(path.join(root, 'courses.json'), 'utf8'));
  return ids.map(id => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid course id: ${id}`);
    const metadata = JSON.parse(fs.readFileSync(path.join(root, 'courses', id, 'metadata.json'), 'utf8'));
    if (metadata.id !== id) throw new Error(`Course id mismatch: ${id}`);
    return { ...metadata, folder: `courses/${id}` };
  });
}
module.exports = { root, loadCourses };
