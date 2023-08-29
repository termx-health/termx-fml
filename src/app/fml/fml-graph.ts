import {FMLStructureGroup} from './fml-structure';

export class FMLGraph {
  private adjacencyList: {[vertex: string]: string[]} = {};

  public static fromFML(fmlGroup: FMLStructureGroup): FMLGraph {
    const g = new FMLGraph();
    Object.keys(fmlGroup.objects).forEach(name => g.addVertex(name));
    fmlGroup.rules.forEach(rule => g.addVertex(rule.name));
    fmlGroup.connections.forEach(c => g.addEdge(c.sourceObject, c.targetObject));
    return g;
  }

  public addVertex(vertex): void {
    this.adjacencyList[vertex] ??= [];
  }

  public addEdge(v1, v2): void {
    this.adjacencyList[v1].push(v2);
  }

  public topologySort(): {[name: string]: number} {
    const vertices = Object.keys(this.adjacencyList);
    const visited = {};
    const topNums = {};

    let n = vertices.length - 1;
    for (const v of vertices) {
      if (!visited[v]) {
        n = this.dfsHelper(v, n, visited, topNums);
      }
    }

    return topNums;
  }

  private dfsHelper(v, n, visited, topNums): number {
    visited[v] = true;
    const neighbors = this.adjacencyList[v];
    for (const neighbor of neighbors) {
      if (!visited[neighbor]) {
        n = this.dfsHelper(neighbor, n, visited, topNums);
      }
    }
    topNums[v] = n;
    return n - 1;
  }
}

