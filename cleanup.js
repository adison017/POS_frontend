const fs = require('fs');
try {
    const content = fs.readFileSync('src/components/POS.jsx', 'utf8');
    const lines = content.split(/\r?\n/);
    console.log('Total lines:', lines.length);

    // We want to keep lines 0..1002 (inclusive) -> length 1003
    // And lines 1450..end (inclusive) -> length (total - 1450)
    // 1-based logic: keep 1..1003, drop 1004..1450, keep 1451..end
    // 0-based lines array: keep 0..1002, drop 1003..1449, keep 1450..end

    const part1 = lines.slice(0, 1003);
    const part2 = lines.slice(1450);

    const newContent = [...part1, ...part2].join('\r\n'); // Use CRLF for windows

    fs.writeFileSync('src/components/POS.jsx', newContent);
    fs.writeFileSync('cleanup.log', 'Success: New line count ' + (part1.length + part2.length));
    console.log('Done');
} catch (e) {
    fs.writeFileSync('cleanup.log', 'Error: ' + e.message);
    console.error(e);
}
