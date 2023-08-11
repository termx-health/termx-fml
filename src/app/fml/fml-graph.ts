import {FMLStructure} from './fml-structure';

export  class FMLGraph {
  adjacencyList: any;

  constructor() {
    this.adjacencyList = {};
  }

  public static fromFML(fml: FMLStructure): FMLGraph {
    const g = new FMLGraph();
    Object.keys(fml.objects).forEach(name => g.addVertex(name));
    fml.rules.forEach(rule => g.addVertex(rule.name));
    fml.connections.forEach(c => g.addEdge(c.sourceObject, c.targetObject));
    return g;
  }

  public addVertex(vertex): void {
    if (!this.adjacencyList[vertex]) {
      this.adjacencyList[vertex] = [];
    }
  }

  public addEdge(v1, v2): void {
    this.adjacencyList[v1].push(v2);
  }


  public dfsTopSort(): {[name: string]: number} {
    const vertices = Object.keys(this.adjacencyList);
    const visited = {};
    const topNums = {};
    let n = vertices.length - 1;
    for (const v of vertices) {
      if (!visited[v]) {
        n = this.dfsTopSortHelper(v, n, visited, topNums);
      }
    }
    return topNums;
  }

  private dfsTopSortHelper(v, n, visited, topNums): number {
    visited[v] = true;
    const neighbors = this.adjacencyList[v];
    for (const neighbor of neighbors) {
      if (!visited[neighbor]) {
        n = this.dfsTopSortHelper(neighbor, n, visited, topNums);
      }
    }
    topNums[v] = n;
    return n - 1;
  }
}

