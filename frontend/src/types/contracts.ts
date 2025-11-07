// Define minimal interfaces for FinCube and FinCubeDAO

export interface FinCube {
    balanceOf(address: string): Promise<string>;
    transfer(to: string, amount: string): Promise<any>;
}

export interface FinCubeDAO {
    createProposal(description: string): Promise<any>;
    vote(proposalId: number, support: boolean): Promise<any>;
    getProposal(proposalId: number): Promise<any>;
    getProposalCount(): Promise<number>;
}