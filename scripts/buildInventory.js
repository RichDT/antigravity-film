const fs = require('fs');

const raw = fs.readFileSync('/tmp/dedup_data.json', 'utf8');
const data = JSON.parse(raw);

let md = `# Duplicate Records — Pre-Deduplication Inventory\n\n`;
md += `Generated: ${new Date().toISOString()}\n\n`;
md += `- **${data.films.length}** duplicate film groups\n`;
md += `- **${data.people.length}** duplicate person groups\n\n`;
md += `---\n\n`;

md += `## Films (${data.films.length} groups)\n\n`;
md += `| Title | Year | Duplicates | Film IDs |\n`;
md += `|---|---|---|---|\n`;
for (const f of data.films) {
  md += `| ${f.title.replace(/\|/g, '\\|')} | ${f.release_year} | ${f.count} | ${f.ids.join(', ')} |\n`;
}

md += `\n---\n\n`;
md += `## People (${data.people.length} groups)\n\n`;
md += `| Name | Duplicates | Person IDs |\n`;
md += `|---|---|---|\n`;
for (const p of data.people) {
  md += `| ${p.name.replace(/\|/g, '\\|')} | ${p.count} | ${p.ids.join(', ')} |\n`;
}

fs.writeFileSync('/tmp/dedup_inventory.md', md);
console.log('Written to /tmp/dedup_inventory.md');
