document.addEventListener('DOMContentLoaded', function() {
  // Tab Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const tabTitle = document.querySelector('.tab-title');
  
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Update active nav item
      navItems.forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
      
      // Show corresponding tab content
      const tabId = this.getAttribute('data-tab');
      tabContents.forEach(tab => tab.classList.remove('active'));
      const activeTab = document.getElementById(tabId);
      activeTab.classList.add('active');
      
      // Update tab title
      tabTitle.textContent = this.textContent.trim();

      // Reinitialize graph when switching to graph view
      if (tabId === 'graph-view') {
        // Small delay to ensure the tab is visible first
        setTimeout(() => {
          initializeGraph();
        }, 50);
      }
    });
  });
  
  // Input Type Tabs
  const inputTabBtns = document.querySelectorAll('.input-tab-btn');
  const urlInput = document.getElementById('url-input');
  const textInput = document.getElementById('text-input');
  
  inputTabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      inputTabBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      const inputType = this.getAttribute('data-input');
      if (inputType === 'url') {
        urlInput.classList.remove('hidden');
        textInput.classList.add('hidden');
      } else {
        urlInput.classList.add('hidden');
        textInput.classList.remove('hidden');
      }
    });
  });
  
  // Theme Toggle
  const themeSwitch = document.getElementById('theme-switch');
  
  themeSwitch.addEventListener('change', function() {
    if (this.checked) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  });
  
  // Check for saved theme preference
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  themeSwitch.checked = savedTheme === 'dark';
  
  // Fact Check Button
  const factCheckBtn = document.getElementById('fact-check-btn');
  const resultsContainer = document.getElementById('results-container');
  
  factCheckBtn.addEventListener('click', function() {
    // Simulate loading
    this.textContent = 'Checking...';
    this.disabled = true;
    
    // Simulate API call with timeout
    setTimeout(() => {
      resultsContainer.classList.remove('hidden');
      this.textContent = 'Fact Check Now';
      this.disabled = false;
      
      // Scroll to results
      resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }, 2000);
  });
  
  // Dashboard card buttons
  const viewGraphBtns = document.querySelectorAll('.view-graph-btn');
  
  viewGraphBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      // Switch to graph view tab and show the corresponding graph
      const graphTab = document.querySelector('.nav-item[data-tab="graph-view"]');
      graphTab.click();
    });
  });
  
  // Initialize Graph View
  initializeGraph();
});

function initializeGraph() {
  // Clear any existing graph
  d3.select('#graph-svg').selectAll('*').remove();
  
  // Set up the SVG with a group for transformations
  const svg = d3.select('#graph-svg');
  const width = svg.node().getBoundingClientRect().width;
  const height = svg.node().getBoundingClientRect().height;
  
  // Add a group that will contain the entire graph
  const container = svg.append('g')
    .attr('class', 'container');
  
  // Initialize zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      container.attr('transform', event.transform);
    });

  // Set initial transform
  const initialTransform = d3.zoomIdentity
    .translate(width/2, height/2);
    
  // Apply initial transform immediately and ensure it's centered
  svg.call(zoom);
  setTimeout(() => {
    svg.transition().duration(0).call(zoom.transform, initialTransform);
  }, 0);

  // Update simulation to use (0,0) as center since we're translating the container
  const simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id).distance(150))
    .force('charge', d3.forceManyBody().strength(-1000).distanceMax(500))
    .force('collision', d3.forceCollide().radius(60))
    .force('x', d3.forceX(0).strength(0.1))
    .force('y', d3.forceY(0).strength(0.1))
    .alphaTarget(0)
    .alphaDecay(0.05);

  // Sample data structure (with root node at center)
  const graphData = {
    nodes: [
      // Fix the root node at the center (0,0)
      { id: 'root', name: 'Input URL: Climate Change Article', type: 'root', fx: 0, fy: 0 },
      { id: 'cnn', name: 'CNN', type: 'source' },
      { id: 'bbc', name: 'BBC', type: 'source' },
      { id: 'nyt', name: 'NY Times', type: 'source' },
      { id: 'dailywire', name: 'Daily Wire', type: 'source' },
      { id: 'nasa', name: 'NASA Climate Data', type: 'supporting' },
      { id: 'noaa', name: 'NOAA Report', type: 'supporting' },
      { id: 'blog1', name: 'Climate Skeptic Blog', type: 'contradicting' }
    ],
    links: [
      { source: 'root', target: 'cnn' },
      { source: 'root', target: 'bbc' },
      { source: 'root', target: 'nyt' },
      { source: 'root', target: 'dailywire' },
      { source: 'cnn', target: 'nasa' },
      { source: 'bbc', target: 'noaa' },
      { source: 'dailywire', target: 'blog1' }
    ]
  };

  // Create the graph elements within the container
  const link = container.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(graphData.links)
    .enter()
    .append('line')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', 2);

  const nodeGroup = container.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(graphData.nodes)
    .enter()
    .append('g')
    .attr('class', 'node-group');

  // Add circles to nodes
  nodeGroup.append('circle')
    .attr('r', d => d.type === 'root' ? 20 : 12)
    .attr('fill', d => {
      switch(d.type) {
        case 'root': return '#4a6cf7';
        case 'source': return '#3498db';
        case 'supporting': return '#28a745';
        case 'contradicting': return '#dc3545';
        default: return '#6c757d';
      }
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5);

  // Add labels with theme-aware text color
  nodeGroup.append('text')
    .attr('dy', 30)
    .attr('text-anchor', 'middle')
    .text(d => d.name.length > 20 ? d.name.substring(0, 17) + '...' : d.name)
    .attr('fill', getComputedStyle(document.body).getPropertyValue('--text-color'))
    .style('font-size', '12px')
    .style('pointer-events', 'none');

  // Add theme change observer
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'data-theme') {
        // Update only text colors when theme changes
        nodeGroup.selectAll('text')
          .attr('fill', getComputedStyle(document.body).getPropertyValue('--text-color'));
      }
    });
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  // Cleanup observer on window unload
  window.addEventListener('unload', () => {
    observer.disconnect();
  });

  // Custom drag behavior
  const drag = d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);

  nodeGroup.call(drag);

  // Modified tick function for smoother animation
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    nodeGroup
      .attr('transform', d => `translate(${d.x},${d.y})`);
  });

  // Initialize simulation with nodes and links
  simulation.nodes(graphData.nodes);
  simulation.force('link').links(graphData.links);

  // Drag functions
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3);
    if (d.id !== 'root') {  // Only set fx/fy during drag for non-root nodes
      d.fx = d.x;
      d.fy = d.y;
    }
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
    simulation.alpha(0.3).restart();
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    if (d.id !== 'root') {  // Release non-root nodes
      d.fx = null;
      d.fy = null;
    }
  }

  // Handle window resize
  function handleResize() {
    const newWidth = svg.node().getBoundingClientRect().width;
    const newHeight = svg.node().getBoundingClientRect().height;
    const newTransform = d3.zoomIdentity.translate(newWidth/2, newHeight/2);
    svg.call(zoom.transform, newTransform);
    simulation.alpha(0.3).restart();
  }

  window.addEventListener('resize', handleResize);

  // Zoom controls
  document.getElementById('zoom-in').addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1.2);
  });

  document.getElementById('zoom-out').addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 0.8);
  });

  document.getElementById('reset-zoom').addEventListener('click', () => {
    const newWidth = svg.node().getBoundingClientRect().width;
    const newHeight = svg.node().getBoundingClientRect().height;
    svg.transition().duration(300)
      .call(zoom.transform, d3.zoomIdentity.translate(newWidth/2, newHeight/2));
  });

  // Call handleResize once to ensure proper initial positioning
  handleResize();

  // Remove the previous resize observer
  if (window.graphResizeObserver) {
    window.graphResizeObserver.disconnect();
  }

  // Create new resize observer
  window.graphResizeObserver = new ResizeObserver(() => {
    if (document.getElementById('graph-view').classList.contains('active')) {
      const newWidth = svg.node().getBoundingClientRect().width;
      const newHeight = svg.node().getBoundingClientRect().height;
      svg.transition().duration(0)
        .call(zoom.transform, d3.zoomIdentity.translate(newWidth/2, newHeight/2));
    }
  });

  // Observe the graph container
  window.graphResizeObserver.observe(document.getElementById('graph-view'));
}

// Cleanup observer when leaving the page
window.addEventListener('unload', () => {
  if (window.graphResizeObserver) {
    window.graphResizeObserver.disconnect();
  }
});