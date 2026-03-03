process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
fetch('https://127.0.0.1:3001/api/system/list-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPaths: ['.'] })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
