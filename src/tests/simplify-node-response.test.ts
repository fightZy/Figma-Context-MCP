import { parseFigmaResponse, findNodeById } from "../services/simplify-node-response";
import type {
  GetFileResponse,
  GetFileNodesResponse,
  Node as FigmaDocumentNode,
  Component,
  ComponentSet,
} from "@figma/rest-api-spec";
import type { SimplifiedDesign, SimplifiedNode } from "../services/simplify-node-response";
import { type StyleId } from "../utils/common";

// A simplified mock for FigmaDocumentNode
const createMockFigmaNode = (
  id: string,
  type: string,
  name: string,
  children?: FigmaDocumentNode[],
  overrides: Partial<FigmaDocumentNode> = {},
): FigmaDocumentNode =>
  ({
    id,
    name,
    type,
    visible: true, // Default to true, can be overridden
    children: children || [],
    ...overrides,
  }) as FigmaDocumentNode;

describe("simplify-node-response", () => {
  // Mock for generateVarId for predictable IDs in tests
  // This mock should be at the top level or within the describe block before tests run.
  let mockIdCounter = 0;
  beforeEach(() => {
    mockIdCounter = 0;
    jest.spyOn(global.Math, "random").mockReturnValue(0.123456789); // Control random part if used by actual generateVarId
  });
  afterEach(() => {
    jest.spyOn(global.Math, "random").mockRestore();
  });

  //   // Actual mock for generateVarId used by the module
  //   // Need to ensure this path is correct and Jest can mock it.
  //   jest.mock('~/utils/common', () => {
  //     const originalModule = jest.requireActual('~/utils/common');
  //     return {
  //       ...originalModule,
  //       generateVarId: jest.fn((prefix: string) => `${prefix}-mockId-${++mockIdCounter}`),
  //       // isVisible is used directly, so we don't mock it unless we want to control its behavior specifically for a test.
  //     };
  //   });

  describe("parseFigmaResponse", () => {
    const mockDate = "2023-10-27T07:00:00Z";
    const mockThumbnailUrl = "http://example.com/thumbnail.png";
    const defaultRole = "viewer";
    const defaultEditorType = "figma";

    const mockComponents: Record<string, Component> = {
      "1:2": { name: "Button", description: "A simple button" } as Component,
    };
    const mockComponentSets: Record<string, ComponentSet> = {
      "S:123": { name: "Button Set", description: "A set of buttons" } as ComponentSet,
    };

    it("should parse GetFileResponse correctly", () => {
      const mockNode = createMockFigmaNode("10:1", "FRAME", "Test Frame");
      const mockFileResponse: GetFileResponse = {
        name: "Test File",
        lastModified: mockDate,
        thumbnailUrl: mockThumbnailUrl,
        components: mockComponents,
        componentSets: mockComponentSets,
        version: "1",
        schemaVersion: 0,
        document: createMockFigmaNode("0:0", "DOCUMENT", "Test Document", [mockNode]) as any,
        styles: {},
        role: defaultRole,
        editorType: defaultEditorType,
      };

      const result = parseFigmaResponse(mockFileResponse);

      expect(result.name).toBe("Test File");
      expect(result.lastModified).toBe(mockDate);
      expect(result.thumbnailUrl).toBe(mockThumbnailUrl);
      expect(result.components["1:2"]?.name).toBe("Button");
      expect(result.componentSets["S:123"]?.name).toBe("Button Set");
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe("10:1");
      expect(result.nodes[0].name).toBe("Test Frame");
    });

    it("should parse GetFileNodesResponse correctly", () => {
      const mockNode1 = createMockFigmaNode("20:1", "RECTANGLE", "Rect1");
      const mockNode2 = createMockFigmaNode("20:2", "TEXT", "Text1");

      const mockFileNodesResponse: GetFileNodesResponse = {
        name: "Test File Nodes",
        lastModified: mockDate,
        thumbnailUrl: mockThumbnailUrl,
        version: "1",
        role: defaultRole,
        editorType: defaultEditorType,
        nodes: {
          "20:1": {
            document: mockNode1,
            components: mockComponents,
            componentSets: {},
            schemaVersion: 0,
            styles: {},
          },
          "20:2": {
            document: mockNode2,
            components: {},
            componentSets: mockComponentSets,
            schemaVersion: 0,
            styles: {},
          },
        },
      };

      const result = parseFigmaResponse(mockFileNodesResponse);

      expect(result.name).toBe("Test File Nodes");
      expect(result.lastModified).toBe(mockDate);
      expect(result.thumbnailUrl).toBe(mockThumbnailUrl);
      expect(result.components["1:2"]?.name).toBe("Button");
      expect(result.componentSets["S:123"]?.name).toBe("Button Set");
      expect(result.nodes.length).toBe(2);
      expect(result.nodes.some((n) => n.id === "20:1")).toBe(true);
      expect(result.nodes.some((n) => n.id === "20:2")).toBe(true);
    });

    it("should handle empty nodes in GetFileNodesResponse", () => {
      const mockFileNodesResponse: GetFileNodesResponse = {
        name: "Empty Nodes File",
        lastModified: mockDate,
        thumbnailUrl: mockThumbnailUrl,
        version: "1",
        role: defaultRole,
        editorType: defaultEditorType,
        nodes: {},
      };
      const result = parseFigmaResponse(mockFileNodesResponse);
      expect(result.nodes).toEqual(undefined);
      expect(result.components).toEqual(undefined);
      expect(result.componentSets).toEqual(undefined);
    });

    it("should handle GetFileResponse with no children in document", () => {
      const mockFileResponse: GetFileResponse = {
        name: "No Children File",
        lastModified: mockDate,
        thumbnailUrl: mockThumbnailUrl,
        components: {},
        componentSets: {},
        version: "1",
        schemaVersion: 0,
        document: createMockFigmaNode("0:0", "DOCUMENT", "Test Document", []) as any,
        styles: {},
        role: defaultRole,
        editorType: defaultEditorType,
      };
      const result = parseFigmaResponse(mockFileResponse);
      expect(result.nodes).toEqual(undefined);
    });

    it("should filter out non-visible nodes at the root", () => {
      const visibleNode = createMockFigmaNode("30:1", "FRAME", "Visible Frame", [], {
        visible: true,
      });
      const nonVisibleNode = createMockFigmaNode("30:2", "RECTANGLE", "Invisible Rect", [], {
        visible: false,
      });
      const mockFileResponse: GetFileResponse = {
        name: "Visibility Test File",
        lastModified: mockDate,
        thumbnailUrl: mockThumbnailUrl,
        components: {},
        componentSets: {},
        version: "1",
        schemaVersion: 0,
        document: createMockFigmaNode("0:0", "DOCUMENT", "Test Document", [
          visibleNode,
          nonVisibleNode,
        ]) as any,
        styles: {},
        role: defaultRole,
        editorType: defaultEditorType,
      };
      const result = parseFigmaResponse(mockFileResponse);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe("30:1");
    });
  });

  describe("parseNode", () => {
    const defaultRole = "viewer";
    const defaultEditorType = "figma";

    // Helper to run parseFigmaResponse for single node tests for brevity
    const parseSingleNodeFile = (node: FigmaDocumentNode): SimplifiedDesign => {
      const mockFileResponse: GetFileResponse = {
        name: "Test File Single Node",
        lastModified: "2023-01-01T00:00:00Z",
        thumbnailUrl: "",
        components: {},
        componentSets: {},
        version: "1",
        schemaVersion: 0,
        document: createMockFigmaNode("0:0", "DOCUMENT", "Doc", [node]) as any,
        styles: {},
        role: defaultRole,
        editorType: defaultEditorType,
      };
      return parseFigmaResponse(mockFileResponse);
    };

    it("should parse a basic FRAME node", () => {
      const mockNode = createMockFigmaNode("1:1", "FRAME", "My Frame");
      const result = parseSingleNodeFile(mockNode);
      const frameNode = result.nodes[0];
      expect(frameNode.id).toBe("1:1");
      expect(frameNode.name).toBe("My Frame");
      expect(frameNode.type).toBe("FRAME");
    });

    it("should convert VECTOR type to IMAGE-SVG", () => {
      const mockNode = createMockFigmaNode("2:1", "VECTOR", "My Vector");
      const result = parseSingleNodeFile(mockNode);
      expect(result.nodes[0].type).toBe("IMAGE-SVG");
    });

    it("should parse children nodes recursively", () => {
      const childNode = createMockFigmaNode("1:3", "RECTANGLE", "Child Rectangle");
      const parentNode = createMockFigmaNode("1:2", "FRAME", "Parent Frame", [childNode]);
      const result = parseSingleNodeFile(parentNode);
      const parent = result.nodes[0];
      expect(parent.children).toBeDefined();
      expect(parent.children?.length).toBe(1);
      expect(parent.children?.[0].id).toBe("1:3");
      expect(parent.children?.[0].name).toBe("Child Rectangle");
    });

    it("should filter out non-visible children", () => {
      const visibleChild = createMockFigmaNode("40:2", "TEXT", "Visible Child", [], {
        visible: true,
      });
      const nonVisibleChild = createMockFigmaNode("40:3", "ELLIPSE", "Invisible Child", [], {
        visible: false,
      });
      const parentNode = createMockFigmaNode("40:1", "GROUP", "Parent Group", [
        visibleChild,
        nonVisibleChild,
      ]);
      const result = parseSingleNodeFile(parentNode);
      const parent = result.nodes[0];
      expect(parent.children?.length).toBe(1);
      expect(parent.children?.[0].id).toBe("40:2");
    });

    it("should parse INSTANCE node with componentId and componentProperties", () => {
      const mockNode = createMockFigmaNode("3:1", "INSTANCE", "My Instance", [], {
        componentId: "C1:100",
        componentProperties: {
          textProperty: { value: "Hello", type: "TEXT" },
          booleanProperty: { value: true, type: "BOOLEAN" },
        },
      });
      const result = parseSingleNodeFile(mockNode);
      const instanceNode = result.nodes[0];

      expect(instanceNode.type).toBe("INSTANCE");
      expect(instanceNode.componentId).toBe("C1:100");
      expect(instanceNode.componentProperties).toEqual([
        { name: "textProperty", value: "Hello", type: "TEXT" },
        { name: "booleanProperty", value: "true", type: "BOOLEAN" },
      ]);
    });

    it("should parse TEXT node with characters", () => {
      const mockNode = createMockFigmaNode("4:1", "TEXT", "My Text", [], {
        characters: "Hello World",
      });
      const result = parseSingleNodeFile(mockNode);
      expect(result.nodes[0].text).toBe("Hello World");
    });

    it("should parse text style properties and create a style variable", () => {
      const mockNode = createMockFigmaNode("5:1", "TEXT", "Styled Text", [], {
        characters: "Styled",
        style: {
          fontFamily: "Arial",
          fontWeight: 700,
          fontSize: 16,
          lineHeightPx: 24,
          letterSpacing: 1.6,
          textCase: "UPPER",
          textAlignHorizontal: "CENTER",
          textAlignVertical: "TOP",
        },
      });
      const result = parseSingleNodeFile(mockNode);
      const textNode = result.nodes[0];
      expect(textNode.textStyle).toBeDefined();
      const styleVar = result.globalVars.styles[textNode.textStyle! as StyleId];
      expect(styleVar).toEqual({
        fontFamily: "Arial",
        fontWeight: 700,
        fontSize: 16,
        lineHeight: "1.5em", // 24/16
        letterSpacing: "10%", // (1.6/16)*100
        textCase: "UPPER",
        textAlignHorizontal: "CENTER",
        textAlignVertical: "TOP",
      });
    });

    it("should handle text style with zero letterSpacing and undefined lineHeightUnit", () => {
      const mockNode = createMockFigmaNode("5:2", "TEXT", "Zero Space Text", [], {
        characters: "ZeroSpace",
        style: {
          fontFamily: "Roboto",
          fontWeight: 400,
          fontSize: 12,
          lineHeightPx: 18,
          // lineHeightUnit: 'PIXELS', // Assuming this leads to lineHeightPx being used
          letterSpacing: 0,
        },
      });
      const result = parseSingleNodeFile(mockNode);
      const textNode = result.nodes[0];
      const styleVar = result.globalVars.styles[textNode.textStyle! as StyleId];
      expect(styleVar).toEqual(
        expect.objectContaining({
          fontFamily: "Roboto",
          fontWeight: 400,
          fontSize: 12,
          lineHeight: "1.5em", // 18/12
        }),
      );
    });

    it("should parse fills and create a fill variable", () => {
      const mockNode = createMockFigmaNode("6:1", "RECTANGLE", "Filled Rect", [], {
        fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 }, blendMode: "NORMAL" }],
      });
      const result = parseSingleNodeFile(mockNode);
      const rectNode = result.nodes[0];
      expect(rectNode.fills).toBeDefined();
      const fillVar = result.globalVars.styles[rectNode.fills! as StyleId];
      // parsePaint converts color from 0-1 to 0-255 for rgba, and creates hex
      expect(fillVar).toEqual(["#FF0000"]);
    });

    it("should parse strokes and create a stroke variable", () => {
      const mockNode = createMockFigmaNode("7:1", "RECTANGLE", "Stroked Rect", [], {
        strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 1, a: 1 }, blendMode: "NORMAL" }],
        strokeWeight: 2,
      });
      const result = parseSingleNodeFile(mockNode);
      const rectNode = result.nodes[0];
      expect(rectNode.strokes).toBeDefined();
      const strokeVar = result.globalVars.styles[rectNode.strokes! as StyleId];
      expect(strokeVar).toEqual({
        colors: ["#0000FF"],
        strokeWeight: "2px",
      });
    });

    it("should parse effects and create an effect variable", () => {
      const mockNode = createMockFigmaNode("8:1", "RECTANGLE", "Effect Rect", [], {
        effects: [
          {
            type: "DROP_SHADOW",
            color: { r: 0, g: 0, b: 0, a: 0.5 },
            offset: { x: 2, y: 2 },
            radius: 4,
            showShadowBehindNode: true,
            blendMode: "NORMAL",
            visible: true,
          },
        ],
      });
      const result = parseSingleNodeFile(mockNode);
      const rectNode = result.nodes[0];
      expect(rectNode.effects).toBeDefined();
      const effectVar = result.globalVars.styles[rectNode.effects! as StyleId];
      expect(effectVar).toEqual({
        boxShadow: "2px 2px 4px 0px rgba(0, 0, 0, 0.5)",
      });
    });

    it("should parse opacity if not 1", () => {
      const mockNode = createMockFigmaNode("9:1", "RECTANGLE", "Opacity Rect", [], {
        opacity: 0.5,
      });
      const result = parseSingleNodeFile(mockNode);
      expect(result.nodes[0].opacity).toBe(0.5);
    });

    it("should not parse opacity if 1", () => {
      const mockNode = createMockFigmaNode("9:2", "RECTANGLE", "Full Opacity Rect", [], {
        opacity: 1,
      });
      const result = parseSingleNodeFile(mockNode);
      expect(result.nodes[0].opacity).toBeUndefined();
    });

    it("should parse cornerRadius", () => {
      const mockNode = createMockFigmaNode("10:1", "RECTANGLE", "Rounded Rect", [], {
        cornerRadius: 8,
      });
      const result = parseSingleNodeFile(mockNode);
      expect(result.nodes[0].borderRadius).toBe("8px");
    });

    it("should parse rectangleCornerRadii", () => {
      const mockNode = createMockFigmaNode("10:2", "RECTANGLE", "Individually Rounded Rect", [], {
        rectangleCornerRadii: [4, 6, 8, 10],
      });
      const result = parseSingleNodeFile(mockNode);
      expect(result.nodes[0].borderRadius).toBe("4px 6px 8px 10px");
    });

    it("should parse layout properties and create a layout variable", () => {
      const mockNode = createMockFigmaNode("11:1", "FRAME", "Layout Frame", [], {
        layoutMode: "HORIZONTAL",
        clipsContent: true,
        itemSpacing: 10,
        paddingLeft: 5,
        paddingRight: 5,
        paddingTop: 10,
        paddingBottom: 10,
        primaryAxisAlignItems: "SPACE_BETWEEN",
      });
      const result = parseSingleNodeFile(mockNode);
      const frameNode = result.nodes[0];
      expect(frameNode.layout).toBeDefined();
      const layoutVar = result.globalVars.styles[frameNode.layout! as StyleId];
      expect(layoutVar).toEqual({
        mode: "row",
        justifyContent: "space-between",
        gap: "10px",
        padding: "10px 5px",
      });
    });

    it("should not create layout variable for default/empty layout", () => {
      const mockNode = createMockFigmaNode("11:2", "RECTANGLE", "No Layout Rect");
      const result = parseSingleNodeFile(mockNode);
      const rectNode = result.nodes[0];
      expect(rectNode.layout).toBeUndefined();
    });
  });

  describe("findOrCreateVar", () => {
    const defaultRole = "viewer";
    const defaultEditorType = "figma";

    const parseNodesForVarTest = (nodes: FigmaDocumentNode[]): SimplifiedDesign => {
      const mockFileResponse: GetFileResponse = {
        name: "Test File For Vars",
        lastModified: "2023-01-01T00:00:00Z",
        thumbnailUrl: "",
        components: {},
        componentSets: {},
        version: "1",
        schemaVersion: 0,
        document: createMockFigmaNode("0:0", "DOCUMENT", "Doc", nodes) as any,
        styles: {},
        role: defaultRole,
        editorType: defaultEditorType,
      };
      return parseFigmaResponse(mockFileResponse);
    };

    it("should create a new variable if value does not exist", () => {
      const mockNode = createMockFigmaNode("12:1", "TEXT", "Text A", [], {
        style: { fontFamily: "Arial", fontSize: 12, lineHeightPx: 12, letterSpacing: 0 },
      });
      const mockNode2 = createMockFigmaNode("12:2", "TEXT", "Text B", [], {
        style: { fontFamily: "Roboto", fontSize: 14, lineHeightPx: 14, letterSpacing: 0 },
      });

      const result = parseNodesForVarTest([mockNode, mockNode2]);
      const nodeA_styleId = result.nodes[0].textStyle;
      const nodeB_styleId = result.nodes[1].textStyle;
      expect(nodeA_styleId).toBeDefined();
      expect(nodeB_styleId).toBeDefined();
      expect(nodeA_styleId).not.toBe(nodeB_styleId); // should be different
      expect(Object.keys(result.globalVars.styles).length).toBe(2);
    });

    it("should reuse existing variable if value already exists", () => {
      const styleDef = {
        fontFamily: "Times New Roman",
        fontSize: 20,
        fontWeight: 400,
        lineHeightPx: 30,
        letterSpacing: 0,
      };
      const mockNode1 = createMockFigmaNode("13:1", "TEXT", "Text Same 1", [], { style: styleDef });
      const mockNode2 = createMockFigmaNode("13:2", "TEXT", "Text Same 2", [], { style: styleDef });

      const result = parseNodesForVarTest([mockNode1, mockNode2]);
      const node1_styleId = result.nodes[0].textStyle;
      const node2_styleId = result.nodes[1].textStyle;

      expect(Object.keys(result.globalVars.styles).length).toBe(1);
      const styleVar = result.globalVars.styles[node1_styleId! as StyleId];
      expect(styleVar).toEqual({
        fontFamily: "Times New Roman",
        fontSize: 20,
        fontWeight: 400,
        lineHeight: "1.5em",
      });
    });
  });

  describe("findNodeById", () => {
    const nodes: SimplifiedNode[] = [
      { id: "1", name: "Node 1", type: "FRAME" },
      {
        id: "2",
        name: "Node 2",
        type: "GROUP",
        children: [
          { id: "2-1", name: "Node 2-1", type: "RECTANGLE" },
          {
            id: "2-2",
            name: "Node 2-2",
            type: "FRAME",
            children: [{ id: "2-2-1", name: "Node 2-2-1", type: "TEXT" }],
          },
        ],
      },
      { id: "3", name: "Node 3", type: "INSTANCE" },
    ];

    it("should find a top-level node by ID", () => {
      const found = findNodeById("1", nodes);
      expect(found).toBeDefined();
      expect(found?.id).toBe("1");
    });

    it("should find a nested node by ID", () => {
      const found = findNodeById("2-2-1", nodes);
      expect(found).toBeDefined();
      expect(found?.id).toBe("2-2-1");
      expect(found?.name).toBe("Node 2-2-1");
    });

    it("should return undefined if node ID is not found", () => {
      const found = findNodeById("404", nodes);
      expect(found).toBeUndefined();
    });

    it("should return undefined for an empty nodes array", () => {
      const found = findNodeById("1", []);
      expect(found).toBeUndefined();
    });
    it("should handle nodes that are null or undefined in the list", () => {
      const nodesWithNullOrUndefined: any[] = [
        { id: "1", name: "Node 1", type: "FRAME" },
        null,
        undefined,
        {
          id: "2",
          name: "Node 2",
          type: "GROUP",
          children: [undefined, { id: "2-1", name: "Node 2-1", type: "RECTANGLE" }, null],
        },
      ];
      // Cast to SimplifiedNode[] for the test, acknowledging the deliberate inclusion of null/undefined
      const typedNodes = nodesWithNullOrUndefined as SimplifiedNode[];

      const found = findNodeById("2-1", typedNodes);
      expect(found).toBeDefined();
      expect(found?.id).toBe("2-1");

      const notFound = findNodeById("3", typedNodes);
      expect(notFound).toBeUndefined();
    });
  });
});
