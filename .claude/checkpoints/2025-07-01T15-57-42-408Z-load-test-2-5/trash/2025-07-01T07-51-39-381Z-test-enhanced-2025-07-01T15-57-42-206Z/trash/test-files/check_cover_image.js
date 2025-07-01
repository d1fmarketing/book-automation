// Find the image
const img = document.querySelector('img');
if (img) {
    // Get image details
    const rect = img.getBoundingClientRect();
    const computedStyle = getComputedStyle(img);
    
    // Check if image is actually visible
    const isVisible = rect.width > 0 && rect.height > 0;
    
    // Get the actual image URL
    const actualSrc = img.src;
    const expectedSrc = 'file:///Users/d1f/Desktop/Ebooks/book-automation/assets/images/cover.jpg';
    
    console.log(JSON.stringify({
        image: {
            src: actualSrc,
            alt: img.alt,
            width: rect.width,
            height: rect.height,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            isVisible: isVisible,
            display: computedStyle.display,
            hasExpectedSrc: actualSrc.includes('cover.jpg'),
            loaded: img.complete && img.naturalHeight \!== 0
        }
    }, null, 2));
} else {
    console.log('No image found');
}
EOF < /dev/null